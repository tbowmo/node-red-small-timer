import { NodeAPI } from 'node-red'
import {
    IPositionNode,
    ISmallTimerNode,
    ISmallTimerProperties,
} from './common'
import { SmallTimerRunner } from '../lib/small-timer-runner'
import { SunAndMoon } from '../lib/sun-and-moon'

export = (RED: NodeAPI): void => {
    RED.nodes.registerType(
        'smalltimer',
        function (this: ISmallTimerNode, props: ISmallTimerProperties) {
            RED.nodes.createNode(this, props)

            this.position = RED.nodes.getNode(
                props.position,
            ) as IPositionNode

            // Hand off the timer function to the timer object
            this.smallTimer = new SmallTimerRunner(
                this.position,
                props,
                this,
            )

            this.on('input', (msg, _send, done) => {
                try {
                    this.smallTimer.onMessage(msg)
                    done()
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } catch (err: any) {
                    done(err)
                }
            })

            this.on('close', () => {
                this.smallTimer.cleanup()
            })
        },
    )

    RED.httpAdmin.get(
        '/smallTimerNodes/:position',
        RED.auth.needsPermission(''),
        async (req, res) => {
            const positionNode = RED.nodes.getNode(
                req.params.position,
            ) as IPositionNode
            if (positionNode?.latitude && positionNode?.longitude) {
                const sunAndMoon = new SunAndMoon(positionNode.latitude, positionNode.longitude)
                res.json(JSON.stringify(sunAndMoon.getTimes()))
            }
        },
    )
}
