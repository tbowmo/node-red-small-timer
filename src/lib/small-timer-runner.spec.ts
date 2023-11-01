import { expect } from 'chai'
import { useSinonSandbox } from '../../test'
import { ISmallTimerProperties } from '../nodes/common'
import { SmallTimerRunner } from './small-timer-runner'
import * as timeCalc from './time-calculation'
import * as Timer from './timer'

describe('lib/small-timer-runner', () => {
    const sinon = useSinonSandbox()

    function setupTest(config?: Partial<ISmallTimerProperties>) {
        const send = sinon.stub().named('node-send')
        const status = sinon.stub().named('node-status')
        const error = sinon.stub().named('node-error')

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const node = { send, status, error } as any
        const position = { latitude: 56.00, longitude: 10.00 }
        const configuration: ISmallTimerProperties = {
            position: '',
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
            minimumOnTime: 0,
            sendEmptyPayload: true,
            id: '',
            type: '',
            name: '',
            z: '',
            ...config,
        }

        const stubbedTimeCalc = {
            getTimeToNextStartEvent: sinon.stub(),
            getTimeToNextEndEvent: sinon.stub(),
            getOnState: sinon.stub().returns(false),
            operationToday: sinon.stub().returns('normal'),
            debug: sinon.stub().returns({debug: 'this is debug'}),
        }

        const stubbedTimer = {
            stop: sinon.stub(),
            start: sinon.stub(),
            active: sinon.stub().returns(false),
            timeLeft: sinon.stub().returns(0),
        }

        return {
            send,
            status,
            TimeCalc: sinon.stub(timeCalc, 'TimeCalc').returns(stubbedTimeCalc),
            Timer: sinon.stub(Timer, 'Timer').returns(stubbedTimer),
            node,
            position,
            configuration,
            stubbedTimeCalc,
            stubbedTimer,
        }
    }

    it('should handle no action today, due to negative on interval', () => {
        const stubs = setupTest()
        stubs.stubbedTimeCalc.getTimeToNextStartEvent.returns(10)
        stubs.stubbedTimeCalc.getTimeToNextEndEvent.returns(20)
        stubs.stubbedTimeCalc.operationToday.returns('noMidnightWrap')

        const runner = new SmallTimerRunner(stubs.position, stubs.configuration, stubs.node)

        runner.onMessage({payload: 'sync', _msgid: ''})
        sinon.assert.calledWith(stubs.node.status, {
            fill: 'yellow',
            shape: 'dot',
            text: 'No action today - off time is before on time',
        })

    })

    it('should handle no action today, due to minimum on time not met', () => {
        const stubs = setupTest()
        stubs.stubbedTimeCalc.getTimeToNextStartEvent.returns(10)
        stubs.stubbedTimeCalc.getTimeToNextEndEvent.returns(20)
        stubs.stubbedTimeCalc.operationToday.returns('minimumOnTimeNotMet')

        const runner = new SmallTimerRunner(stubs.position, stubs.configuration, stubs.node)

        runner.onMessage({payload: 'sync', _msgid: ''})
        sinon.assert.calledWith(stubs.node.status, {
            fill: 'yellow',
            shape: 'dot',
            text: 'No action today - minimum on time not met',
        })
    })

    it('should handle temporary on and use timeout to calculate next change', () => {
        const stubs = setupTest({
            onTimeout: 5,
        })

        stubs.stubbedTimeCalc.getTimeToNextStartEvent.returns(20)
        stubs.stubbedTimeCalc.getTimeToNextEndEvent.returns(30)
        stubs.stubbedTimer.timeLeft.returns(5)
        stubs.stubbedTimer.active.returns(true)

        const runner = new SmallTimerRunner(stubs.position, stubs.configuration, stubs.node)

        runner.onMessage({ payload: 'on', _msgid: 'some-id' })

        sinon.assert.calledWithExactly(stubs.status, { fill: 'green', shape: 'ring', text: 'Temporary ON for 05mins' })
        sinon.assert.calledWith(stubs.stubbedTimer.start, 5)
    })

    it('should handle temporary off and use nextStartEvent to calculate next change', async () => {
        const stubs = setupTest()

        stubs.stubbedTimeCalc.getTimeToNextStartEvent.returns(20)
        stubs.stubbedTimeCalc.getTimeToNextEndEvent.returns(30)
        stubs.stubbedTimeCalc.getOnState.returns(true)

        const runner = new SmallTimerRunner(stubs.position, stubs.configuration, stubs.node)

        runner.onMessage({ payload: 'off', _msgid: 'some-id' })

        sinon.assert.calledWith(
            stubs.status.lastCall,
            { fill: 'red', shape: 'ring', text: 'Temporary OFF for 20mins' },
        )

        runner.onMessage({ payload: 'auto', _msgid: 'some-id' })
        sinon.assert.calledWithExactly(
            stubs.status.lastCall,
            { fill: 'green', shape: 'dot', text: 'ON for 30mins' },
        )
    })

    it('should send a new change msg when timer tick kicks in and state has changed', async () => {
        const stubs = setupTest({
            topic: 'test-topic',
            onMsg: 'on-msg',
            offMsg: '0',
            injectOnStartup: true,
        })

        stubs.stubbedTimeCalc.getTimeToNextStartEvent.returns(0)
        stubs.stubbedTimeCalc.getTimeToNextEndEvent.returns(120.6)
        stubs.stubbedTimeCalc.getOnState.returns(false)

        const runner = new SmallTimerRunner(stubs.position, stubs.configuration, stubs.node)

        runner.onMessage({payload: 'sync', _msgid: ''})
        sinon.clock.tick(60000)

        sinon.assert.calledWithExactly(stubs.status, { fill: 'red', shape: 'dot', text: 'OFF for 00mins 00secs' })
        sinon.assert.calledWithExactly(stubs.send, {
            state: 'auto',
            stamp: 2000,
            autoState: true,
            duration: 0,
            temporaryManual: false,
            timeout: 0,
            payload: '0',
            topic: 'test-topic',
            trigger: 'timer',
        })
        stubs.stubbedTimeCalc.getOnState.returns(true)
        sinon.clock.tick(60000)

        sinon.assert.calledWithExactly(
            stubs.status.lastCall,
            { fill: 'green', shape: 'dot', text: 'ON for 02hrs 01mins' },
        )
        sinon.assert.calledWithExactly(stubs.send.lastCall, {
            state: 'auto',
            stamp: 90000,
            autoState: true,
            duration: 0,
            temporaryManual: false,
            timeout: 0,
            payload: 'on-msg',
            topic: 'test-topic',
            trigger: 'timer',
        })
    })

    it('should send update together with an debug message when debug is enabled', () => {
        const stubs = setupTest({
            topic: 'test-topic',
            onMsg:'on',
            offMsg: 'off',
            injectOnStartup: true,
            debugEnable: true,
        })

        stubs.stubbedTimeCalc.getTimeToNextStartEvent.returns(0)
        stubs.stubbedTimeCalc.getTimeToNextEndEvent.returns(120.6)
        stubs.stubbedTimeCalc.getOnState.returns(false)

        const runner = new SmallTimerRunner(stubs.position, stubs.configuration, stubs.node)

        runner.onMessage({payload: 'sync', _msgid: ''})
        sinon.clock.tick(2000)
        sinon.assert.calledWith(stubs.send, [
            {
                state: 'auto',
                stamp: 2000,
                autoState: true,
                duration: 0,
                temporaryManual: false,
                timeout: 0,
                payload: 'off',
                topic: 'test-topic',
                trigger: 'timer',
            },
            { debug: 'this is debug', override: 'auto', topic: 'debug' },
        ])
    })


    it('should not send message with empty payload', () => {
        const stubs = setupTest({
            topic: 'test-topic',
            onMsg:'on',
            offMsg: '', // empty string should not be sendt
            injectOnStartup: true,
            debugEnable: true,
            sendEmptyPayload: false,
        })

        stubs.stubbedTimeCalc.getTimeToNextStartEvent.returns(0)
        stubs.stubbedTimeCalc.getTimeToNextEndEvent.returns(120.6)
        stubs.stubbedTimeCalc.getOnState.returns(false)

        const runner = new SmallTimerRunner(stubs.position, stubs.configuration, stubs.node)

        runner.onMessage({payload: 'sync', _msgid: ''})
        sinon.clock.tick(2000)
        sinon.assert.calledWith(stubs.send, [
            null,
            { debug: 'this is debug', override: 'auto', topic: 'debug' },
        ])

    })

    it('should stop timer, and not advance anything after cleanup has been called', async () => {
        const stubs = setupTest({
            topic: 'test-topic',
            onMsg: 'on-msg',
            offMsg: '0',
            injectOnStartup: true,
        })

        stubs.stubbedTimeCalc.getTimeToNextStartEvent.returns(0)
        stubs.stubbedTimeCalc.getTimeToNextEndEvent.returns(20)
        stubs.stubbedTimeCalc.getOnState.returns(false)

        const runner = new SmallTimerRunner(stubs.position, stubs.configuration, stubs.node)
        sinon.clock.tick(5000)
        runner.cleanup()

        sinon.assert.calledWithExactly(stubs.status, { fill: 'red', shape: 'dot', text: 'OFF for 00mins 00secs' })
        sinon.assert.calledWithExactly(stubs.send, {
            state: 'auto',
            stamp: 2000,
            autoState: true,
            duration: 0,
            temporaryManual: false,
            timeout: 0,
            payload: '0',
            topic: 'test-topic',
            trigger: 'timer',
        })
        stubs.stubbedTimeCalc.getOnState.returns(true)
        sinon.clock.tick(1200000)
        await Promise.resolve()
        expect(stubs.status.callCount).to.equal(1)
        expect(stubs.send.callCount).to.equal(1)
    })

    describe('message input', () => {
        it('should toggle output when toggle message received', async () => {
            const stubs = setupTest({
                topic: 'test-topic',
                onMsg: 'on-msg',
                offMsg: '0',
                injectOnStartup: true,
                onTimeout: 30,
            })

            stubs.stubbedTimeCalc.getTimeToNextStartEvent.returns(0)
            stubs.stubbedTimeCalc.getTimeToNextEndEvent.returns(20)
            stubs.stubbedTimeCalc.getOnState.returns(false)

            const runner = new SmallTimerRunner(stubs.position, stubs.configuration, stubs.node)
            sinon.clock.tick(80000)

            sinon.assert.calledWithExactly(stubs.status, { fill: 'red', shape: 'dot', text: 'OFF for 00mins 00secs' })
            sinon.assert.calledWithExactly(stubs.send, {
                state: 'auto',
                stamp: 2000,
                autoState: true,
                duration: 0,
                temporaryManual: false,
                timeout: 0,
                payload: '0',
                topic: 'test-topic',
                trigger: 'timer',
            })

            runner.onMessage({ payload: 'toggle', _msgid: 'some-msg' })

            sinon.assert.calledWith(stubs.stubbedTimer.start, 30)
            sinon.assert.calledWithExactly(
                stubs.status.lastCall,
                { fill: 'green', shape: 'ring', text: 'Temporary ON for 20mins' },
            )
            sinon.assert.calledWithExactly(stubs.send.lastCall, {
                state: 'tempOn',
                stamp: 80000,
                autoState: false,
                duration: 0,
                temporaryManual: true,
                timeout: 0,
                payload: 'on-msg',
                topic: 'test-topic',
                trigger: 'input',
            })

            runner.onMessage({ payload: 'toggle', _msgid: 'some-msg' })

            sinon.assert.calledWithExactly(
                stubs.status.lastCall,
                { fill: 'red', shape: 'dot', text: 'OFF for 00mins 00secs' },
            )
            sinon.assert.calledWithExactly(stubs.send.lastCall, {
                state: 'auto',
                stamp: 80000,
                autoState: true,
                duration: 0,
                temporaryManual: false,
                timeout: 0,
                payload: '0',
                topic: 'test-topic',
                trigger: 'input',
            })
        })

        it('should output node status when sync message is received, without changing properties', () => {
            const stubs = setupTest({
                topic: 'test-topic',
                onMsg: 'on-msg',
                offMsg: '0',
                injectOnStartup: true,
            })

            stubs.stubbedTimeCalc.getTimeToNextStartEvent.returns(0)
            stubs.stubbedTimeCalc.getTimeToNextEndEvent.returns(20)
            stubs.stubbedTimeCalc.getOnState.returns(false)

            const runner = new SmallTimerRunner(stubs.position, stubs.configuration, stubs.node)
            sinon.clock.tick(80000)

            sinon.assert.calledWithExactly(stubs.status, { fill: 'red', shape: 'dot', text: 'OFF for 00mins 00secs' })
            sinon.assert.calledWithExactly(stubs.send, {
                state: 'auto',
                stamp: 2000,
                autoState: true,
                duration: 0,
                temporaryManual: false,
                timeout: 0,
                payload: '0',
                topic: 'test-topic',
                trigger: 'timer',
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
                topic: 'test-topic',
                trigger: 'input',
            }])
        })

        it('should use timeout property to override timeout', () => {
            const stubs = setupTest({
                topic: 'test-topic',
                onMsg: 'on-msg',
                offMsg: '0',
                injectOnStartup: true,
            })

            stubs.stubbedTimeCalc.getTimeToNextStartEvent.returns(0)
            stubs.stubbedTimeCalc.getTimeToNextEndEvent.returns(20)
            stubs.stubbedTimeCalc.getOnState.returns(false)

            const runner = new SmallTimerRunner(stubs.position, stubs.configuration, stubs.node)
            sinon.clock.tick(80000)

            sinon.assert.calledWithExactly(stubs.status, { fill: 'red', shape: 'dot', text: 'OFF for 00mins 00secs' })
            sinon.assert.calledWithExactly(stubs.send, {
                state: 'auto',
                stamp: 2000,
                autoState: true,
                duration: 0,
                temporaryManual: false,
                timeout: 0,
                payload: '0',
                topic: 'test-topic',
                trigger: 'timer',
            })

            runner.onMessage({ payload: 'toggle', timeout: 10, _msgid: 'some-msg' })

            sinon.assert.calledWith(stubs.stubbedTimer.start, 10)
        })

        it('should throw error if timeout property cannot be converted to number', () => {
            const stubs = setupTest({
                topic: 'test-topic',
                onMsg: 'on-msg',
                offMsg: '0',
                injectOnStartup: false,
            })

            stubs.stubbedTimeCalc.getTimeToNextStartEvent.returns(0)
            stubs.stubbedTimeCalc.getTimeToNextEndEvent.returns(20)
            stubs.stubbedTimeCalc.getOnState.returns(false)

            const runner = new SmallTimerRunner(stubs.position, stubs.configuration, stubs.node)
            sinon.clock.tick(80000)

            sinon.assert.calledWithExactly(stubs.status, { fill: 'red', shape: 'dot', text: 'OFF for 00mins 00secs' })

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(runner.onMessage.bind(runner.onMessage, { payload: 'invalid', timeout: 'notANumber', _msgid: 'some-id' } as any))
                .to.throw('Timeout value "notANumber" can not be converted to a number')

            expect(stubs.send.callCount).to.equal(0)  
        })

        it('should signal error if invalid message is received', () => {
            const stubs = setupTest({
                topic: 'test-topic',
                onMsg: 'on-msg',
                offMsg: '0',
                injectOnStartup: false,
            })

            stubs.stubbedTimeCalc.getTimeToNextStartEvent.returns(0)
            stubs.stubbedTimeCalc.getTimeToNextEndEvent.returns(20)
            stubs.stubbedTimeCalc.getOnState.returns(false)

            const runner = new SmallTimerRunner(stubs.position, stubs.configuration, stubs.node)
            sinon.clock.tick(80000)

            sinon.assert.calledWithExactly(stubs.status, { fill: 'red', shape: 'dot', text: 'OFF for 00mins 00secs' })

            expect(runner.onMessage.bind(runner.onMessage, { payload: 'invalid', _msgid: 'some-id' }))
                .to.throw('Did not understand the command \'invalid\' supplied in payload')

            expect(stubs.send.callCount).to.equal(0)
        })
    })

    describe('rules check', () => {
        it('should exclude a specific day of week', () => {
            const stubs = setupTest({
                rules: [
                    { type: 'include', month: 0, day: 0 },
                    { type: 'exclude', month: 12, day: 101 }, // 101 is monday
                ],
            })
            stubs.stubbedTimeCalc.getTimeToNextStartEvent.returns(0)
            stubs.stubbedTimeCalc.getTimeToNextEndEvent.returns(20)
            stubs.stubbedTimeCalc.getOnState.returns(false)

            const runner = new SmallTimerRunner(stubs.position, stubs.configuration, stubs.node)

            sinon.clock.setSystemTime(new Date('2023-12-04')) // December 4th 2023 is a monday
            runner.onMessage({ payload: 'sync', _msgid: '' })
            sinon.assert.calledWithExactly(
                stubs.status.lastCall,
                { fill: 'yellow', shape: 'dot', text: 'No action today' },
            )

            sinon.clock.setSystemTime(new Date('2023-12-05')) // December 4th 2023 is a tuesday
            runner.onMessage({ payload: 'sync', _msgid: '' })
            sinon.assert.calledWithExactly(
                stubs.status.lastCall,
                { fill: 'red', shape: 'dot', text: 'OFF for 00mins 00secs' },
            )

        })

        it('should include a day in a excluded month', () => {
            const stubs = setupTest({
                rules: [
                    { type: 'include', month: 0, day: 0 },
                    { type: 'exclude', month: 5, day: 0 },
                    { type: 'include', month: 5, day: 11 },
                ],
            })
            stubs.stubbedTimeCalc.getTimeToNextStartEvent.returns(0)
            stubs.stubbedTimeCalc.getTimeToNextEndEvent.returns(20)
            stubs.stubbedTimeCalc.getOnState.returns(false)

            const runner = new SmallTimerRunner(stubs.position, stubs.configuration, stubs.node)

            sinon.clock.setSystemTime(new Date('2023-05-04'))
            runner.onMessage({ payload: 'sync', _msgid: '' })
            sinon.assert.calledWithExactly(
                stubs.status.lastCall,
                { fill: 'yellow', shape: 'dot', text: 'No action today' },
            )

            sinon.clock.setSystemTime(new Date('2023-05-11'))
            runner.onMessage({ payload: 'sync', _msgid: '' })
            sinon.assert.calledWithExactly(
                stubs.status.lastCall,
                { fill: 'red', shape: 'dot', text: 'OFF for 00mins 00secs' },
            )
        })
    })
})
