import { NodeMessage, NodeMessageInFlow } from 'node-red'

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
    state: string
}
