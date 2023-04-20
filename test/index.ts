import { createSandbox } from 'sinon'
import type { InstalledClock } from '@sinonjs/fake-timers'
import * as fakeTimers from '@sinonjs/fake-timers'

const clock: InstalledClock = fakeTimers.install()

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
        }
    }
}

