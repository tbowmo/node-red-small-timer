/* istanbul ignore next */

import { Node, NodeDef } from 'node-red'
import { SmallTimerRunner } from '../lib/small-timer-runner'

/* Configuration */
export interface IPositionNode extends Node {
    latitude: number,
    longitude: number
}

export type Rule = {
    type: 'include' | 'exclude',
    month: number,
    day: number,
}
export interface IPositionProperties extends NodeDef {
    latitude: number,
    longitude: number,
}

export interface ISmallTimerNode extends Node {
    position: IPositionNode,
    smallTimer: SmallTimerRunner
}

export interface ISmallTimerProperties extends NodeDef {
    position: string,
    startTime: number,
    endTime: number,
    startOffset: number,
    endOffset: number,
    onMsg: string,
    onMsgType: string,
    offMsg: string,
    offMsgType: string,
    topic: string,
    injectOnStartup: boolean,
    repeat: boolean,
    disable: boolean,
    rules: Rule[],
    onTimeout: number,
    offTimeout: number,
    wrapMidnight: boolean,
    debugEnable: boolean,
    minimumOnTime: number,
    sendEmptyPayload: boolean,
}
