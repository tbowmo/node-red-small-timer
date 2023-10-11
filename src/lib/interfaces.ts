import { NodeMessage, NodeMessageInFlow } from 'node-red'

export type State = 'auto' | 'tempOn' | 'tempOff'
export type Trigger = 'input' | 'timer'

export interface ISmallTimerMessage extends NodeMessageInFlow {
    reset?: boolean,
    timeout?: number,
}

export type SmallTimerChangeMessage = NodeMessage & {
    autoState: boolean,
    timeout: number,
    temporaryManual: boolean,
    duration: number,
    stamp: number,
    state: State,
    trigger: Trigger
}
