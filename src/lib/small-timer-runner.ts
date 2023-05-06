/*eslint complexity: ["error", 13]*/
import { Node, NodeMessage, NodeStatus, NodeStatusFill, util } from 'node-red'
import { ISmallTimerProperties, Rule } from '../nodes/common'
import { SmallTimerChangeMessage, ISmallTimerMessage } from './interfaces'
import { TimeCalc } from './time-calculation'

type Override = 'auto' | 'tempOn' | 'tempOff'

type NodeFunctions = Node

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
    private onMsgType: string
    private offMsgType: string
    private rules: Rule[]
    private repeat: boolean
    private onTimeout: number
    private offTimeout: number
    private currentTimeout = 0

    private timeCalc: TimeCalc
    private debugMode = false

    constructor(
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
        this.onMsgType = configuration.onMsgType
        this.offMsgType = configuration.offMsgType
        this.rules = configuration.rules
        this.repeat = configuration.repeat
        this.debugMode = configuration.debugEnable

        this.onTimeout = Number(configuration.onTimeout)
        this.offTimeout = Number(configuration.offTimeout)
        if (configuration.injectOnStartup) {
            this.startupTock = setTimeout(this.forceSend.bind(this), 2000)
        } else {
            this.calcState()
            this.updateNodeStatus()
        }
        this.startTickTimer()
    }

    private getCurrentState() {
        return this.override === 'auto'
            ? this.currentState
            : (this.override === 'tempOn')
    }

    public generateDebug(): NodeMessage {
        return {
            ...this.timeCalc.debug(),
            override: this.override,
            topic: 'debug'
        } as NodeMessage // we cheat a bit to escape type checking in typescript
    }

    private generateMsg(): SmallTimerChangeMessage {
        const on = this.getCurrentState()

        const payload = on
            ? util.evaluateNodeProperty(this.onMsg, this.onMsgType, this.node, {})
            : util.evaluateNodeProperty(this.offMsg, this.offMsgType, this.node, {})

        return {
            state: this.override,
            stamp: Date.now(),
            autoState: this.override === 'auto',
            duration: 0,
            temporaryManual: this.override !== 'auto',
            timeout: this.currentTimeout,
            payload: payload,
            topic: this.topic,
        }
    }

    private publishState() {
        if (this.debugMode) {
            this.node.send([this.generateMsg(), this.generateDebug()])
        } else {
            this.node.send(this.generateMsg())
        }
    }

    private isDayOk(date = new Date()): boolean {
        const month = date.getMonth() + 1
        const dayOfMonth = date.getDate()
        const dayOfWeek = date.getDay()

        const validMonths = [0, month]
        const validDays = [0, dayOfMonth, dayOfWeek + 100]

        let isOk = false

        this.rules.forEach((item: Rule) => {
            const ruleMonth = Number(item.month)
            const ruleDay = Number(item.day)

            if (validMonths.includes(ruleMonth)
                && validDays.includes(ruleDay)) {
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
        let doPublish = false
        if (this.currentTimeout > 0) {
            this.currentTimeout -= 1

            if (this.currentTimeout === 0 && this.override !== 'auto') {
                this.override = 'auto'
                doPublish = true
            }
        }
        const change = this.calcState()

        this.updateNodeStatus()

        if (change || this.repeat || doPublish) {
            this.publishState()
        }
    }

    private forceSend() {
        this.calcState()
        this.updateNodeStatus()
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
    private updateNodeStatus() {
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
            fill = 'red'
            let state = 'OFF'
            let nextAutoChange = this.timeCalc.getMinutesToNextStartEvent()

            if (this.getCurrentState()) {
                // Signal that we have turned ON
                fill = 'green'
                state = 'ON'
                nextAutoChange = this.timeCalc.getMinutesToNextEndEvent()
            }
            const timeout = this.currentTimeout
            const nextTimeoutOrAuto = (timeout && timeout < nextAutoChange)
                ? timeout
                : nextAutoChange

            if (this.override !== 'auto') {
                text.length = 0 // Reset array
                text.push(`Temporary ${state} for ${this.getHourAndMinutes(nextTimeoutOrAuto)}`)
            }
            else {
                text.push(`${state} for ${this.getHourAndMinutes(nextTimeoutOrAuto)}`)
            }
        }
        const status: NodeStatus = {
            fill,
            shape: this.override !== 'auto' ? 'ring' : 'dot',
            text: text.join(' - ')
        }

        this.node.status(status)
    }

    private doOverride(override: Override) {
        this.override = override
        if (override === 'auto') {
            this.currentTimeout = 0
            return
        }

        // requested temporary state is the same as what would be the current auto state
        // So let's just set it to auto
        if ((override === 'tempOn') === this.currentState) {
            this.override = 'auto'
            this.currentTimeout = 0
            return
        }

        this.currentTimeout = override === 'tempOn'
            ? this.onTimeout
            : this.offTimeout
    }

    /**
     * Handle messages as they are received
     * @param incomingMsg
     */
    // eslint-disable-next-line complexity
    public onMessage(
        incomingMsg: Readonly<ISmallTimerMessage>,
    ) {
        const payload = typeof incomingMsg.payload === 'string'
            ? incomingMsg.payload.toLocaleLowerCase()
            : incomingMsg.payload
        switch (payload) {
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
                this.override = ((this.override === 'tempOn') || (this.override === undefined && this.currentState))
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
                this.node.error('Did not understand the command in payload property', incomingMsg)
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
