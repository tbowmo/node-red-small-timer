
const granularity = 60000

/**
 * Basic "timer" class, handles timeouts in minutes, and can give feedback on current number of minutes
 * left until timer expires.
 */
export class Timer {
    private currentTimeout = 0
    private timer: ReturnType<typeof setTimeout> | undefined

    /**
     * Starts a new timer in minutes, an optional callback can be given to call when timer runs out
     *
     * @param desiredTimeout timeout in minutes
     * @param cb optional callback to call when timeout is reached
     */
    public start(desiredTimeout: number, cb?: () => void) {
        const timeout = desiredTimeout * granularity
        this.currentTimeout = Date.now() + timeout

        if (cb) {
            if (this.timer) {
                clearTimeout(this.timer) // First kill old timeout if it exists
            }
            this.timer = setTimeout(cb, timeout)
        }
    }

    /**
     * Stop current timer
     */
    public stop() {
        this.currentTimeout = 0
        if (this.timer) {
            clearTimeout(this.timer)
            this.timer = undefined
        }
    }

    /**
     * @returns true if timer is active
     */
    public active() {
        return Date.now() < this.currentTimeout
    }

    /**
     * @returns Number of minutes until timer runs out
     */
    public timeLeft() {
        const time = this.currentTimeout - Date.now()
        return time > 0 ? (time / granularity) : 0
    }
}
