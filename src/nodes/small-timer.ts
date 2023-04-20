import { NodeAPI } from 'node-red'
import { IPositionNode, ISmallTimerNode, ISmallTimerProperties } from './common'
import { SmallTimerRunner } from '../lib/small-timer-runner'
import { ISmallTimerMessage } from '../lib/interfaces'

/* istanbul ignore next */
export = (RED: NodeAPI): void => {
    RED.nodes.registerType(
        'smalltimer',
        function (this: ISmallTimerNode, props: ISmallTimerProperties) {
            RED.nodes.createNode(this, props)
            if (props.position) {
                this.position = RED.nodes.getNode(
                    props.position,
                ) as IPositionNode

                // Hand off the timer function to the timer object
                this.smallTimer = new SmallTimerRunner(
                    this.position,
                    props,
                    this
                )

                this.on('input', (msg: ISmallTimerMessage, _send, done) => {
                    this.smallTimer.onMessage(msg)
                    done()
                })

                this.on('close', () => {
                    this.smallTimer.cleanup()
                })
            }
        }
    )
}
