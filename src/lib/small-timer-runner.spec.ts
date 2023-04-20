import { useSinonSandbox } from '../../test'
import { ISmallTimerProperties } from '../nodes/common'
import {SmallTimerRunner} from './small-timer-runner'
import * as timeCalc from './time-calculation'

describe('small-timer/time-runner', () => {
    const sinon = useSinonSandbox()

    function setupTest(config?: Partial<ISmallTimerProperties>) {
        const send = sinon.stub().named('node-send')
        const status = sinon.stub().named('node-status')

        const node = {send, status}
        const position = {latitude: 56.00, longitude: 10.00}
        const configuration:ISmallTimerProperties = {
            startTime: 0,
            endTime: 0,
            startOffset: 0,
            endOffset: 0,
            onMsg: '',
            offMsg: '',
            topic: '',
            injectOnStartup: false,
            repeat: false,
            disable: false,
            rules: [{type: 'include', month: 0, day: 0}],
            timeout: 0,
            wrapMidnight: false,
            id: '',
            type: '',
            name: '',
            z: '',
            ...config
        }

        const stubbedTimeCalc = {
            getMinutesToNextStartEvent: sinon.stub(),
            getMinutesToNextEndEvent: sinon.stub(),
            getOnState: sinon.stub().returns(false)
        }
        return {
            send,
            status,
            x: sinon.stub(timeCalc, 'TimeCalc').returns(stubbedTimeCalc),
            node,
            position,
            configuration,
            timeCalc: stubbedTimeCalc
        }
    }

    it('should handLE temporary on and use timeout to calculate next change', () => {
        const stubs = setupTest({
            timeout: 5
        })

        stubs.timeCalc.getMinutesToNextStartEvent.returns(20)
        stubs.timeCalc.getMinutesToNextEndEvent.returns(30)
        const runner = new SmallTimerRunner(stubs.position, stubs.configuration, stubs.node)

        runner.onMessage({payload: 'on', _msgid: 'some-id'})

        sinon.assert.calledWithExactly(stubs.status, { fill: 'green', shape: 'ring', text: 'Temporary ON for 05mins'})
    })

    it('should handle temporary off and use nextStartEvent to calculate next change', () => {
        const stubs = setupTest()

        stubs.timeCalc.getMinutesToNextStartEvent.returns(20)
        stubs.timeCalc.getMinutesToNextEndEvent.returns(30)

        const runner = new SmallTimerRunner(stubs.position, stubs.configuration, stubs.node)

        runner.onMessage({payload: 'off', _msgid: 'some-id' })

        sinon.assert.calledWithExactly(
            stubs.status.lastCall,
            {fill: 'blue', shape: 'ring', text: 'Temporary OFF for 20mins'}
        )

        runner.onMessage({payload: 'auto', _msgid: 'some-id'})
        sinon.assert.calledWithExactly(
            stubs.status.lastCall,
            {fill:  'blue', shape:'dot', text: 'OFF for 20mins'}
        )
    })

    it('should send a new change msg when timer tick kicks in and state has changed', async () => {
        const stubs = setupTest({
            topic: 'test-topic',
            onMsg: 'on-msg',
            offMsg: '0',
            injectOnStartup: true
        })

        stubs.timeCalc.getMinutesToNextStartEvent.returns(0)
        stubs.timeCalc.getMinutesToNextEndEvent.returns(20)
        stubs.timeCalc.getOnState.returns(false)

        new SmallTimerRunner(stubs.position, stubs.configuration, stubs.node)
        sinon.clock.tick(60000)

        sinon.assert.calledWithExactly(stubs.status, {fill: 'blue', shape: 'dot', text: 'OFF for 00mins'})
        sinon.assert.calledWithExactly(stubs.send, {
            state: 'auto',
            stamp: 2000,
            autoState: true,
            duration: 0,
            temporaryManual: false,
            timeout: 0,
            payload: '0',
            topic: 'test-topic'
        })
        stubs.timeCalc.getOnState.returns(true)
        sinon.clock.tick(60000)
        await Promise.resolve()
        sinon.assert.calledWithExactly(stubs.status, {fill: 'green', shape: 'dot', text: 'ON for 20mins'})
        sinon.assert.calledWithExactly(stubs.send, {
            state: 'auto',
            stamp: 120000,
            autoState: true,
            duration: 0,
            temporaryManual: false,
            timeout: 0,
            payload: 'on-msg',
            topic: 'test-topic'
        })
    })

    it('should toggle output when toggle message received', async () => {
        const stubs = setupTest({
            topic: 'test-topic',
            onMsg: 'on-msg',
            offMsg: '0',
            injectOnStartup: true
        })

        stubs.timeCalc.getMinutesToNextStartEvent.returns(0)
        stubs.timeCalc.getMinutesToNextEndEvent.returns(20)
        stubs.timeCalc.getOnState.returns(false)

        const runner = new SmallTimerRunner(stubs.position, stubs.configuration, stubs.node)
        sinon.clock.tick(80000)

        sinon.assert.calledWithExactly(stubs.status, {fill: 'blue', shape: 'dot', text: 'OFF for 00mins'})
        sinon.assert.calledWithExactly(stubs.send, {
            state: 'auto',
            stamp: 2000,
            autoState: true,
            duration: 0,
            temporaryManual: false,
            timeout: 0,
            payload: '0',
            topic: 'test-topic'
        })

        runner.onMessage({payload: 'toggle', _msgid: 'some-msg'})

        sinon.assert.calledWithExactly(
            stubs.status.lastCall,
            {fill: 'green', shape: 'ring', text: 'Temporary ON for 20mins'}
        )
        sinon.assert.calledWithExactly(stubs.send.lastCall, {
            state: 'tempOn',
            stamp: 80000,
            autoState: false,
            duration: 0,
            temporaryManual: true,
            timeout: 0,
            payload: 'on-msg',
            topic: 'test-topic'
        })

        runner.onMessage({payload: 'toggle', _msgid: 'some-msg'})

        sinon.assert.calledWithExactly(
            stubs.status.lastCall,
            {fill: 'blue', shape: 'ring', text: 'Temporary OFF for 00mins'}
        )
        sinon.assert.calledWithExactly(stubs.send.lastCall, {
            state: 'tempOff',
            stamp: 80000,
            autoState: false,
            duration: 0,
            temporaryManual: true,
            timeout: 0,
            payload: '0',
            topic: 'test-topic'
        })


    })

})
