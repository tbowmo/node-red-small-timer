import helper from 'node-red-node-test-helper'
import position from './position'
import { expect } from 'chai'
import { IPositionProperties } from './common'

helper.init(require.resolve('node-red'))

describe('node/position', () => {
  
    afterEach(function () {
        helper.unload()
    })

    it('Should load configuration node', function (done) {
        const flow: IPositionProperties[] = [
            { id: 'n1', type: 'position', name: 'position', latitude: 10.0, longitude: 11.0, z: '' }
        ]
        helper.load(position, flow, function () {
            const n1 = helper.getNode('n1')
            try {
                expect(n1).to.have.property('name').which.equals('position')
                expect(n1).to.have.property('latitude', 10.0)
                expect(n1).to.have.property('longitude', 11.0)
                done()
            } catch(err) {
                done(err)
            }
        })
    })
})
