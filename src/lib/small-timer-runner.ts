/*eslint complexity: ["error", 12]*/
import {
    Node,
    NodeMessage,
    NodeStatus,
    NodeStatusFill,
} from 'node-red'
import { util } from '@node-red/util'
import { ISmallTimerProperties, Rule } from '../nodes/common'
import { SmallTimerChangeMessage, ISmallTimerMessage } from './interfaces'
import { TimeCalc } from './time-calculation'
import { Timer } from './timer'

type Override = 'auto' | 'tempOn' | 'tempOff'

type NodeFunctions = Node

type Position = {
    latitude: number,
    longitude: number,
}

const pad = (n: number) => n < 10 ? `0${n.toFixed(0)}` : `${n.toFixed(0)}`

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
    // private currentTimeout = 0

    private timeCalc: TimeCalc
    private debugMode = false

    private timer = new Timer()

    constructor(
        position: Position,
        configuration: ISmallTimerProperties,
        private node: NodeFunctions,
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

    /**
     * Calculates the current state of the output (combines override and auto state)
     * @returns boolean
     */
    private getCurrentState(): boolean {
        return this.override === 'auto'
            ? this.currentState
            : (this.override === 'tempOn')
    }

    private generateDebug(): NodeMessage {
        return {
            ...this.timeCalc.debug(),
            override: this.override,
            topic: 'debug',
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
            timeout: this.timer.timeLeft(),
            payload: payload,
            topic: this.topic,
        }
    }

    private publishState(): void {
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
    private timerEvent(): void {
        const change = this.calcState()

        this.updateNodeStatus()

        if (change || this.repeat) {
            this.publishState()
        }
    }

    private forceSend(): void {
        this.calcState()
        this.updateNodeStatus()
        this.publishState()
    }

    /**
     * Convert a time in minutes to hours / minutes string
     * @param time
     * @returns
     */
    private getHumanTime(time: number): string {
        const hour = Math.floor(time / 60)
        const minutes = time % 60
        // Seconds are fractions, so we need to "up-cycle" them
        const seconds = Math.floor((time - Math.floor(time)) * 60)

        const str: string[] = []

        if (hour) {
            str.push(`${pad(hour)}hrs`)
        }
        if (minutes >= 2 || hour) {
            str.push(`${pad(minutes)}mins`)
        }
        if (minutes<2 && !hour) {
            str.push(`${pad(Math.floor(minutes))}mins`)
            str.push(`${pad(seconds)}secs`)
        }
        return str.join(' ')
    }

    /**
     * Updates the node status
     */
    private updateNodeStatus(): void {
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
            let nextAutoChange = this.timeCalc.getTimeToNextStartEvent()

            if (this.getCurrentState()) {
                // Signal that we have turned ON
                fill = 'green'
                state = 'ON'
                nextAutoChange = this.timeCalc.getTimeToNextEndEvent()
            }
            const timeout = this.timer.timeLeft()
            const nextTimeoutOrAuto = timeout && (timeout < nextAutoChange)
                ? timeout
                : nextAutoChange

            if (this.override !== 'auto') {
                text.length = 0 // Reset array
                text.push(`Temporary ${state} for ${this.getHumanTime(nextTimeoutOrAuto)}`)
            }
            else {
                text.push(`${state} for ${this.getHumanTime(nextTimeoutOrAuto)}`)
            }
        }

        const status: NodeStatus = {
            fill,
            shape: this.override !== 'auto' ? 'ring' : 'dot',
            text: text.join(' - '),
        }

        this.node.status(status)
    }

    private doOverride(override: Override): void {
        this.override = override
        if (override === 'auto') {
            this.timer.stop()
            return
        }

        // requested temporary state is the same as what would be the current auto state
        // So let's just set it to auto
        if ((override === 'tempOn') === this.currentState) {
            this.override = 'auto'
            this.timer.stop()
            return
        }

        const timeout = override === 'tempOn'
            ? this.onTimeout
            : this.offTimeout

        this.timer.start(timeout, () => {
            this.override = 'auto'
            this.forceSend()
        })
    }

    /**
     * Handle messages as they are received
     * @param incomingMsg
     */
    // eslint-disable-next-line complexity
    public onMessage(
        incomingMsg: Readonly<ISmallTimerMessage>,
    ): void {
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
            this.doOverride(this.getCurrentState()
                ? 'tempOff'
                : 'tempOn',
            )
            break
        case 'auto':
        case 'default':
            this.doOverride('auto')
            break
        case 'sync':
            break
        default:
            throw new Error(`Did not understand the command '${incomingMsg.payload}' supplied in payload`)
        }
        this.forceSend()
    }

    /**
     * Cleanup before closing down (ie. remove timers)
     */
    /* istanbul ignore next */
    public cleanup(): void {
        if (this.startupTock) {
            clearTimeout(this.startupTock)
        }
        this.stopTickTimer()
    }

    /* istanbul ignore next */
    private stopTickTimer(): void {
        if (this.tickTimer) {
            clearInterval(this.tickTimer)
            this.tickTimer = undefined
        }
    }

    private startTickTimer(interval = 30000): void {
        if (this.tickTimer) {
            // Stop old timers, if they are running
            this.stopTickTimer()
        }
        this.tickTimer = setInterval(this.timerEvent.bind(this), interval)
    }
}
