import { createSandbox } from 'sinon'
import * as fakeTimers from '@sinonjs/fake-timers'

const clock: fakeTimers.Clock = fakeTimers.install()

export const useSinonSandbox = () => {
    const sandbox = createSandbox()

    afterEach(() => {
        clock.setSystemTime(0)
        sandbox.restore()
    })

    return {
        ...sandbox,
        get clock() {
            return clock
        },
    }
}

