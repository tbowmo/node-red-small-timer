import helper from 'node-red-node-test-helper'
import smallTimer from './small-timer'
import { expect } from 'chai'
import { useSinonSandbox } from '../../test'
import * as runner from '../lib/small-timer-runner'

helper.init(require.resolve('node-red'))

describe('node/small-timer', () => {
    const sinon = useSinonSandbox()

    // beforeEach(function (done) {
    //     helper.startServer(done)
    // })
  
    afterEach(function () {
        helper.unload()
    })

    function setupStub() {
        const onMessage = sinon.stub().named('onMessage')
        const cleanup = sinon.stub().named('cleanup')
        const mockedInstance = {
            onMessage,
            cleanup,
        }
        return {
            smallTimerRunner: sinon.stub(runner, 'SmallTimerRunner').returns(mockedInstance),
            onMessage,
            cleanup,
        }
    }

    it('Should load and initialize node', async () => {
        const stubs = setupStub()
        
        const flow  = [
            { 
                id: 'n1', 
                position: 'home-position',
                type: 'smalltimer', 
                name: 'small-timer', 
                debugEnable: false,
                disable: false,
                endOffset: 0,
                endTime: 0,
                injectOnStartup: false,
                offMsg: '',
                offMsgType: '',
                offTimeout: 0,
                onMsg: '',
                onMsgType: '',
                onTimeout: 0,
                repeat: false,
                rules: [],
                startOffset: 0,
                startTime: 0,
                topic: '',
                wrapMidnight: false,
            }, 
        ]

        await helper.load(smallTimer, flow)
        await new Promise((resolve, reject) => {
            const n1 = helper.getNode('n1')
            try {
                expect(n1).to.have.property('name').which.equals('small-timer')
                sinon.assert.calledOnce(stubs.smallTimerRunner)
                sinon.assert.calledWith(stubs.smallTimerRunner, null, {
                    id: 'n1',
                    position: 'home-position',
                    type: 'smalltimer',
                    name: 'small-timer',
                    debugEnable: false,
                    disable: false,
                    endOffset: 0,
                    endTime: 0,
                    injectOnStartup: false,
                    offMsg: '',
                    offMsgType: '',
                    offTimeout: 0,
                    onMsg: '',
                    onMsgType: '',
                    onTimeout: 0,
                    repeat: false,
                    rules: [],
                    startOffset: 0,
                    startTime: 0,
                    topic: '',
                    wrapMidnight: false,
                    _users: [],                  
                })
                resolve(1)
            } catch(err) {
                reject(err)
            }
        })
    })

    it('should handle incomming message', async () => {
        const stubs = setupStub()

        const flow  = [
            { 
                id: 'n1', 
                position: 'home-position',
                type: 'smalltimer', 
                name: 'small-timer', 
                debugEnable: false,
                disable: false,
                endOffset: 0,
                endTime: 0,
                injectOnStartup: false,
                offMsg: '',
                offMsgType: '',
                offTimeout: 0,
                onMsg: '',
                onMsgType: '',
                onTimeout: 0,
                repeat: false,
                rules: [],
                startOffset: 0,
                startTime: 0,
                topic: '',
                wrapMidnight: false,
            }, 
        ]

        await helper.load(smallTimer, flow)
        await new Promise((resolve, reject) => {
            const n1 = helper.getNode('n1')
            try {
                n1.receive({payload: 'test', _msgid: 'testid'})
                sinon.assert.calledWith(stubs.onMessage, {payload: 'test', _msgid: 'testid'})
                resolve(1)
            } catch (e) {
                reject(e)
            }
        })
    })

    it('should handle return error if runner throws an error', async () => {
        const stubs = setupStub()
        stubs.onMessage.throws(new Error('test error'))

        const flow  = [
            { 
                id: 'n1', 
                position: 'home-position',
                type: 'smalltimer', 
                name: 'small-timer', 
                debugEnable: false,
                disable: false,
                endOffset: 0,
                endTime: 0,
                injectOnStartup: false,
                offMsg: '',
                offMsgType: '',
                offTimeout: 0,
                onMsg: '',
                onMsgType: '',
                onTimeout: 0,
                repeat: false,
                rules: [],
                startOffset: 0,
                startTime: 0,
                topic: '',
                wrapMidnight: false,
            }, 
        ]

        await helper.load(smallTimer, flow)
        await new Promise((resolve, reject) => {
            const n1 = helper.getNode('n1')
            try {
                n1.error = (err) => {
                    expect(err).to.deep.equal(Error('test error'))
                }
                n1.receive({payload: 'test', _msgid: 'testid'})
                resolve(1)
            } catch (e) {
                reject(e)
            }
        })
    })

})
