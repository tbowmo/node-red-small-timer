import { expect } from 'chai'
import { useSinonSandbox } from '../../test'
import { Timer } from './timer'

describe('lib/timer', () => {
    const sinon = useSinonSandbox()

    it('should start a timer', () => {
        const timer = new Timer()
        const cbSpy = sinon.spy().named('callback')

        timer.start(10, cbSpy)
        sinon.clock.tick(60000 * 5)

        expect(timer.timeLeft()).to.equal(5)
        expect(timer.active()).to.equal(true)
        sinon.assert.notCalled(cbSpy)

        sinon.clock.tick(60000 * 5)

        expect(timer.timeLeft()).to.equal(0)
        sinon.assert.calledOnce(cbSpy)
    })

    it('should stop timer if requested', async () => {
        const timer = new Timer()
        const cbSpy = sinon.spy().named('callback')

        timer.start(20, cbSpy)
        sinon.clock.tick(60000 * 10)

        expect(timer.timeLeft()).to.equal(10)
        sinon.assert.notCalled(cbSpy)
        timer.stop()

        expect(timer.timeLeft()).to.equal(0)
        sinon.assert.notCalled(cbSpy)
    })

    it('should clear current timeout timer when new is started', () => {
        const timer = new Timer()
        const clearTimeoutSpy = sinon.spy(sinon.clock, 'clearTimeout')
        const cbSpy1 = sinon.spy().named('spy-1')
        const cbSpy2 = sinon.spy().named('spy-2')

        timer.start(5, cbSpy1)
        sinon.clock.tick(60000 * 4)
        sinon.assert.notCalled(cbSpy1)

        timer.start(1, cbSpy2)
        sinon.assert.calledOnce(clearTimeoutSpy)

        sinon.clock.tick(60000 * 1)
        sinon.assert.notCalled(cbSpy1)
        sinon.assert.calledOnce(cbSpy2)
    })

    it('should handle timer without callback assignment', () => {
        const timer = new Timer()

        timer.start(5)
        sinon.clock.tick(60000 * 1)
        expect(timer.timeLeft()).equals(4)
        expect(timer.active()).equals(true)

        timer.stop()
        sinon.clock.tick(60000 * 1)
        expect(timer.timeLeft()).equals(0)
        expect(timer.active()).equals(false)
    })
})
