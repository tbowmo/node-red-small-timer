import { expect } from 'chai'
import { useSinonSandbox } from '../../test'
import { Timer } from './timer'

describe('small-timer/timer', () => {
    const sinon = useSinonSandbox()

    it('should start a timer', () => {
        const timer = new Timer()
        const cbSpy = sinon.spy().named('callback')

        timer.start(10, cbSpy)
        sinon.clock.tick(60000 * 5)

        expect(timer.timeLeft()).to.equal(5)
        sinon.assert.notCalled(cbSpy)

        sinon.clock.tick(60000 * 5)

        expect(timer.timeLeft()).to.equal(0)
        sinon.assert.calledOnce(cbSpy)
    })

    it('should stop timer if requested', () => {
        const timer = new Timer()
        const cbSpy = sinon.spy().named('callback')

        timer.start(20, cbSpy)
        sinon.clock.tick(60000 * 10)

        expect(timer.timeLeft()).to.equal(10)
        sinon.assert.notCalled(cbSpy)
        timer.stop()
        sinon.clock.tick(60000 * 20)

        expect(timer.timeLeft()).to.equal(0)
        sinon.assert.notCalled(cbSpy)
    })
})
