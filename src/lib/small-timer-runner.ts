/*eslint complexity: ["error", 13]*/
import { Node, NodeStatusFill } from 'node-red'
import { ISmallTimerProperties, Rule } from '../nodes/common'
import { SmallTimerChangeMessage, ISmallTimerMessage } from './interfaces'
import { TimeCalc } from './time-calculation'

type Override = 'auto' | 'tempOn' | 'tempOff'

type NodeFunctions = Pick<Node, 'status' | 'send'>

type Position = {
    latitude: number,
    longitude: number,
}

export class SmallTimerRunner {

    private startupTock: ReturnType<typeof setTimeout> | undefined = undefined

    // Timing variables
    private tickTimer: ReturnType<typeof setInterval> | undefined = undefined

    private override: Override = 'auto'
    private currentState = false

    private topic: string
    private onMsg: string
    private offMsg: string
    private rules: Rule[]
    private repeat: boolean
    private timeout: number
    private currentTimeout = 0

    private timeCalc: TimeCalc

    constructor (
        position: Position,
        configuration: ISmallTimerProperties,
        private node: NodeFunctions
    ) {
        this.timeCalc = new TimeCalc(
            Number(position.latitude),
            Number(position.longitude),
            configuration.wrapMidnight,
            Number(configuration.startTime),
            Number(configuration.endTime),
            Number(configuration.startOffset),
            Number(configuration.endOffset),
        )

        this.topic = configuration.topic
        this.onMsg = configuration.onMsg
        this.offMsg = configuration.offMsg
        this.rules = configuration.rules
        this.repeat = configuration.repeat
        this.timeout = Number(configuration.timeout)
        if (configuration.injectOnStartup) {
            this.startupTock = setTimeout(this.forceSend.bind(this), 2000)
        } else {
            this.updateStatus()
        }
        this.startTickTimer()
    }

    private publishState(){
        const on = this.override === 'tempOn' || this.currentState

        const msg: SmallTimerChangeMessage = {
            state: this.override,
            stamp: Date.now(),
            autoState: this.override === 'auto',
            duration: 0,
            temporaryManual: this.override !== 'auto',
            timeout: this.currentTimeout,
            payload: on ? this.onMsg : this.offMsg,
            topic: this.topic,
        }
        this.node.send(msg)
    }

    private isDayOk(date = new Date()): boolean {
        const month = date.getMonth() + 1
        const day = date.getDate()
        const weekDay = date.getDay()

        const validMonths = [0, month]
        const validDays = [0, day, weekDay + 100]

        let isOk = false

        this.rules.forEach((item: Rule) => {
            item.month = Number(item.month)
            item.day = Number(item.day)
            if (validMonths.includes(item.month)
                && validDays.includes(item.day)) {
                isOk = item.type === 'include'
            }
        })
        return isOk
    }

    /**
     * Calculates, and set, new state. If a change from previous state is detected, the method returns true,
     * otherwise it returns false
     */
    private calcState(): boolean {
        const date = new Date()
        const newState = this.timeCalc.getOnState(date)

        // Check if the new state is different, because then we need to send a change event
        if ((this.isDayOk(date) || this.currentState) && (newState !== this.currentState)) {
            this.currentState = newState
            return true
        }

        return false
    }

    /**
     * Handle timer updates
     */
    private timerEvent() {
        if (this.currentTimeout > 0) {
            this.currentTimeout -= 1

            if (this.currentTimeout === 0 && this.override !== 'auto') {
                this.override = 'auto'
            }
        }
        const change = this.calcState()

        this.updateStatus()

        if (change || this.repeat) {
            this.publishState()
        }
    }

    private forceSend() {
        this.calcState()
        this.updateStatus()
        this.publishState()
    }

    /**
     * Convert a time in minutes to hours / minutes string
     * @param time
     * @returns
     */
    private getHourAndMinutes(time: number): string {
        const minutes = time % 60
        const hour = Math.floor(time / 60)
        const pad = (n: number) => n < 10 ? `0${n.toFixed(0)}` : `${n.toFixed(0)}`

        const hourStr = hour ? `${pad(hour)}hrs ` : ''
        return `${hourStr}${pad(minutes)}mins`
    }

    /**
     * Updates the node status
     */
    private updateStatus() {
        let fill: NodeStatusFill = 'yellow'
        const text: string[] = []

        const activeToday = !this.timeCalc.noOnStateToday() && (this.isDayOk() || this.currentState)

        if (!activeToday) {
            text.push('No action today')
        }

        if (this.timeCalc.noOnStateToday()) {
            text.push('off time is before on time')
        }

        if (activeToday || this.override !== 'auto') {
            // default off state
            fill = 'blue'
            let state = 'OFF'
            let nextAutoChange = this.timeCalc.getMinutesToNextStartEvent()

            if (this.override === 'tempOn' || this.currentState) {
                // Signal that we have turned ON
                fill = 'green'
                state = 'ON'
                nextAutoChange =  this.timeCalc.getMinutesToNextEndEvent()
            }

            const nextTimeoutOrAuto = (this.currentTimeout && this.currentTimeout < nextAutoChange)
                ? this.currentTimeout
                : nextAutoChange

            const statusText = this.override !== 'auto'
                ? `Temporary ${state} for ${this.getHourAndMinutes(nextTimeoutOrAuto)}`
                : `${state} for ${this.getHourAndMinutes(nextTimeoutOrAuto)}`

            text.push(statusText)
        }

        this.node.status({
            fill,
            shape: this.override !== 'auto' ? 'ring' : 'dot',
            text: text.join(' - ')
        })
    }

    private doOverride(override: Override) {
        this.override = override
        this.updateStatus()
        if (override === 'auto') {
            this.currentTimeout = 0
            return
        }
        this.currentTimeout = this.timeout
        if ((override === 'tempOn' && !this.currentState)
            || this.currentState) {
            this.publishState()
        }
    }

    /**
     * Handle messages as they are received
     * @param incomingMsg
     */
    // eslint-disable-next-line complexity
    public onMessage(
        incomingMsg: Readonly<ISmallTimerMessage>,
    ) {
        switch (incomingMsg.payload) {
            case 0:
            case '0':
            case 'off':
            case false:
                this.doOverride('tempOff')
                break
            case 1:
            case '1':
            case 'on':
            case true:
                this.doOverride('tempOn')
                break
            case 'toggle':
                this.override = (!(this.override !== 'tempOn') || (this.override === undefined && this.currentState))
                    ? 'tempOff'
                    : 'tempOn'
                break
            case 'auto':
            case 'default':
                this.doOverride('auto')
                break
            case 'sync':
                break
            default:
                return
        }
        this.forceSend()
    }

    /**
     * Cleanup before closing down (ie. remove timers)
     */
    /* istanbul ignore next */
    public cleanup() {
        if (this.startupTock) {
            clearTimeout(this.startupTock)
        }
        this.stopTickTimer()
    }
    /* istanbul ignore next */
    private stopTickTimer() {
        if (this.tickTimer) {
            clearInterval(this.tickTimer)
            this.tickTimer = undefined
        }
    }

    private startTickTimer(interval = 60000) {
        if (this.tickTimer === undefined) {
            // only start if we are not running already
            this.tickTimer = setInterval(this.timerEvent.bind(this), interval)
        }
    }
}
