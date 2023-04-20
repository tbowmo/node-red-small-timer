/* istanbul ignore file */

import { NodeAPI } from 'node-red'

import { IPositionNode, IPositionProperties } from './common'

export = (RED: NodeAPI) => {
    RED.nodes.registerType(
        'position',
        function position(this: IPositionNode, props: IPositionProperties) {
            RED.nodes.createNode(this, props)
            this.latitude = props.latitude
            this.longitude = props.longitude
        },
    )
}
