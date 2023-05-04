import { expect } from 'chai'
import { useSinonSandbox } from '../../test'
import { ISmallTimerProperties } from '../nodes/common'
import { SmallTimerRunner } from './small-timer-runner'
import * as timeCalc from './time-calculation'

describe('small-timer/time-runner', () => {
    const sinon = useSinonSandbox()

    function setupTest(config?: Partial<ISmallTimerProperties>) {
        const send = sinon.stub().named('node-send')
        const status = sinon.stub().named('node-status')

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const node = { send, status } as any
        const position = { latitude: 56.00, longitude: 10.00 }
        const configuration: ISmallTimerProperties = {
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
            rules: [{ type: 'include', month: 0, day: 0 }],
            onTimeout: 1440,
            offTimeout: 1440,
            offMsgType: 'str',
            onMsgType: 'str',
            wrapMidnight: false,
            debugEnable: false,
            id: '',
            type: '',
            name: '',
            z: '',
            ...config
        }

        const stubbedTimeCalc = {
            getMinutesToNextStartEvent: sinon.stub(),
            getMinutesToNextEndEvent: sinon.stub(),
            getOnState: sinon.stub().returns(false),
            noOnStateToday: sinon.stub().returns(false)
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

    it('should handle no action today, due to negative on interval', () => {
        const stubs = setupTest()
        stubs.timeCalc.getMinutesToNextStartEvent.returns(10)
        stubs.timeCalc.getMinutesToNextEndEvent.returns(20)
        stubs.timeCalc.noOnStateToday.returns(true)

        new SmallTimerRunner(stubs.position, stubs.configuration, stubs.node)

        sinon.assert.calledWith(stubs.node.status, {
            fill: 'yellow',
            shape: 'dot',
            text: 'No action today - off time is before on time'
        })
    })

    it('should handle temporary on and use timeout to calculate next change', () => {
        const stubs = setupTest({
            onTimeout: 5
        })

        stubs.timeCalc.getMinutesToNextStartEvent.returns(20)
        stubs.timeCalc.getMinutesToNextEndEvent.returns(30)
        const runner = new SmallTimerRunner(stubs.position, stubs.configuration, stubs.node)

        runner.onMessage({ payload: 'on', _msgid: 'some-id' })

        sinon.assert.calledWithExactly(stubs.status, { fill: 'green', shape: 'ring', text: 'Temporary ON for 05mins' })
    })

    it('should handle temporary off and use nextStartEvent to calculate next change', async () => {
        const stubs = setupTest()

        stubs.timeCalc.getMinutesToNextStartEvent.returns(20)
        stubs.timeCalc.getMinutesToNextEndEvent.returns(30)
        stubs.timeCalc.getOnState.returns(true)

        const runner = new SmallTimerRunner(stubs.position, stubs.configuration, stubs.node)

        runner.onMessage({ payload: 'off', _msgid: 'some-id' })

        sinon.assert.calledWith(
            stubs.status.lastCall,
            { fill: 'red', shape: 'ring', text: 'Temporary OFF for 20mins' }
        )

        runner.onMessage({ payload: 'auto', _msgid: 'some-id' })
        sinon.assert.calledWithExactly(
            stubs.status.lastCall,
            { fill: 'green', shape: 'dot', text: 'ON for 30mins' }
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

        sinon.assert.calledWithExactly(stubs.status, { fill: 'red', shape: 'dot', text: 'OFF for 00mins' })
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
        sinon.assert.calledWithExactly(stubs.status, { fill: 'green', shape: 'dot', text: 'ON for 20mins' })
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

    describe('message input', () => {
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

            sinon.assert.calledWithExactly(stubs.status, { fill: 'red', shape: 'dot', text: 'OFF for 00mins' })
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

            runner.onMessage({ payload: 'toggle', _msgid: 'some-msg' })

            sinon.assert.calledWithExactly(
                stubs.status.lastCall,
                { fill: 'green', shape: 'ring', text: 'Temporary ON for 20mins' }
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

            runner.onMessage({ payload: 'toggle', _msgid: 'some-msg' })

            sinon.assert.calledWithExactly(
                stubs.status.lastCall,
                { fill: 'red', shape: 'ring', text: 'Temporary OFF for 00mins' }
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

        it('should output node status when sync message is received, without changing properties', () => {
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

            sinon.assert.calledWithExactly(stubs.status, { fill: 'red', shape: 'dot', text: 'OFF for 00mins' })
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

            runner.onMessage({ payload: 'sync', _msgid: 'some-id' })
            runner.onMessage({ payload: 'sync', _msgid: 'some-id' })
            runner.onMessage({ payload: 'sync', _msgid: 'some-id' })
            runner.onMessage({ payload: 'sync', _msgid: 'some-id' })

            expect(stubs.send.callCount).to.equal(5)
            expect(stubs.send.lastCall.args).to.deep.equal([{
                state: 'auto',
                stamp: 80000,
                autoState: true,
                duration: 0,
                temporaryManual: false,
                timeout: 0,
                payload: '0',
                topic: 'test-topic'
            }])
        })

        it('should do nothing if invalid message is received', () => {
            const stubs = setupTest({
                topic: 'test-topic',
                onMsg: 'on-msg',
                offMsg: '0',
                injectOnStartup: false
            })

            stubs.timeCalc.getMinutesToNextStartEvent.returns(0)
            stubs.timeCalc.getMinutesToNextEndEvent.returns(20)
            stubs.timeCalc.getOnState.returns(false)

            const runner = new SmallTimerRunner(stubs.position, stubs.configuration, stubs.node)
            sinon.clock.tick(80000)

            sinon.assert.calledWithExactly(stubs.status, { fill: 'red', shape: 'dot', text: 'OFF for 00mins' })

            runner.onMessage({ payload: 'invalid', _msgid: 'some-id' })
            runner.onMessage({ payload: 'invalid', _msgid: 'some-id' })
            runner.onMessage({ payload: 'invalid', _msgid: 'some-id' })
            runner.onMessage({ payload: 'invalid', _msgid: 'some-id' })

            expect(stubs.send.callCount).to.equal(0)
        })
    })

    it('should stop timer, and not advance anything after cleanup has been called', async () => {
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
        sinon.clock.tick(5000)
        runner.cleanup()

        sinon.assert.calledWithExactly(stubs.status, { fill: 'red', shape: 'dot', text: 'OFF for 00mins' })
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
        sinon.clock.tick(1200000)
        await Promise.resolve()
        expect(stubs.status.callCount).to.equal(1)
        expect(stubs.send.callCount).to.equal(1)
    })

    describe('rules check', () => {
        it('should exclude a specific day of week', () => {
            const stubs = setupTest({
                rules: [
                    { type: 'include', month: 0, day: 0 },
                    { type: 'exclude', month: 12, day: 101 }, // 101 is monday
                ]
            })
            stubs.timeCalc.getMinutesToNextStartEvent.returns(0)
            stubs.timeCalc.getMinutesToNextEndEvent.returns(20)
            stubs.timeCalc.getOnState.returns(false)

            const runner = new SmallTimerRunner(stubs.position, stubs.configuration, stubs.node)

            sinon.clock.setSystemTime(new Date('2023-12-04')) // December 4th 2023 is a monday
            runner.onMessage({ payload: 'sync', _msgid: '' })
            sinon.assert.calledWithExactly(
                stubs.status.lastCall,
                { fill: 'yellow', shape: 'dot', text: 'No action today' }
            )

            sinon.clock.setSystemTime(new Date('2023-12-05')) // December 4th 2023 is a tuesday
            runner.onMessage({ payload: 'sync', _msgid: '' })
            sinon.assert.calledWithExactly(
                stubs.status.lastCall,
                { fill: 'red', shape: 'dot', text: 'OFF for 00mins' }
            )

        })

        it('should include a day in a excluded month', () => {
            const stubs = setupTest({
                rules: [
                    { type: 'include', month: 0, day: 0 },
                    { type: 'exclude', month: 5, day: 0 },
                    { type: 'include', month: 5, day: 11 },
                ]
            })
            stubs.timeCalc.getMinutesToNextStartEvent.returns(0)
            stubs.timeCalc.getMinutesToNextEndEvent.returns(20)
            stubs.timeCalc.getOnState.returns(false)

            const runner = new SmallTimerRunner(stubs.position, stubs.configuration, stubs.node)

            sinon.clock.setSystemTime(new Date('2023-05-04'))
            runner.onMessage({ payload: 'sync', _msgid: '' })
            sinon.assert.calledWithExactly(
                stubs.status.lastCall,
                { fill: 'yellow', shape: 'dot', text: 'No action today' }
            )

            sinon.clock.setSystemTime(new Date('2023-05-11'))
            runner.onMessage({ payload: 'sync', _msgid: '' })
            sinon.assert.calledWithExactly(
                stubs.status.lastCall,
                { fill: 'red', shape: 'dot', text: 'OFF for 00mins' }
            )
        })
    })
})
