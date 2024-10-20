import SunCalc from 'suncalc'
import { SunAndMoon } from './sun-and-moon'
import { isNotUndefinedOrNull } from './utils'

const wholeDay = 1440 // Whole day in minutes

/**
 * Encapsulates logic for start and end times, including dynamically adjusted times (sunset, sunrise etc)
 */
export class TimeCalc extends SunAndMoon {


    private actualStart = 0
    private actualEnd = 0
    private lastRecalcTime = -1

    /**
     *
     * @param latitude
     * @param longitude
     * @param wrapMidnight
     */
    constructor(
        latitude: number | undefined,
        longitude: number | undefined,
        private wrapMidnight: boolean,
        private startTime: number,
        private endTime: number,
        private startOffset: number,
        private endOffset: number,
        private minimumOnTime: number,
    ) {
        super(latitude, longitude)
        this.eventCalculation()
    }

    private convertDateToTime<
    T extends (SunCalc.GetTimesResult | SunCalc.GetMoonTimes),
    P extends keyof T
>(
        times: T | undefined,
    ): Record<string, number> {
        return Object.fromEntries(
            Object.values(this.sunLookup)
                .map((key) => {
                    if (times && (key in times)) {
                        const t = times[(key as P)]
                        return t === undefined ? undefined : [key, this.getTime(t as Date)]
                    }
                })
                .filter(isNotUndefinedOrNull),
        )
    }

    /**
     * Get debug information from sunCalc
     * @returns debug information
     */
    public debug() {
        const sunTimes = this.convertDateToTime(this.sunTimes)

        const moonTimes = this.convertDateToTime(this.moonTimes)

        return {
            sunTimes,
            moonTimes,
            now: this.getTime(new Date()),
            actualStart: this.actualStart,
            actualEnd: this.actualEnd,
            nextStart: this.getTimeToNextStartEvent(),
            nextEnd: this.getTimeToNextEndEvent(),
            onState: this.getOnState(),
            operationToday: this.operationToday(),
        }
    }

    /**
     * Sets a new start / end time. any undefined props keeps the current value
     * @param startTime
     * @param endTime
     * @param startOffset
     * @param endOffset
     */
    public setStartEndTime(
        startTime = this.startTime,
        endTime = this.endTime,
        startOffset = this.startOffset,
        endOffset = this.endOffset,
    ) {
        const changedProp = !(
            startTime === this.startTime
            && endTime === this.endTime
            && startOffset === this.startOffset
            && endOffset === this.endOffset
        )

        this.startTime = startTime
        this.endTime = endTime
        this.startOffset = startOffset
        this.endOffset = endOffset
        this.eventCalculation(changedProp)
    }

    /**
     * Get number of minutes to next start event. Will add 24 hours if negative
     * @param date optional date object
     * @returns
     */
    public getTimeToNextStartEvent(date = new Date()): number {
        const currentTime = this.getTime(date)
        const nextEvent = this.actualStart - currentTime
        return nextEvent >= 0 ? nextEvent : (nextEvent + wholeDay)
    }

    /**
     * Get number of minutes to next end event, will add 24 hours if negative
     * @param date optional date object
     * @returns
     */
    public getTimeToNextEndEvent(date = new Date()): number {
        const currentTime = this.getTime(date)
        const nextEvent = this.actualEnd - currentTime
        return nextEvent >= 0 ? nextEvent : (nextEvent + wholeDay)
    }

    private onTime(): number {
        const onTime = this.actualEnd - this.actualStart

        if (this.wrapMidnight && onTime < 0) {
            return onTime + wholeDay
        }

        return onTime
    }

    /**
     * Returns the actual on state, according to the current time
     *
     * @param date optional date
     * @returns
     */
    public getOnState(date = new Date()): boolean {
        const currentTime = this.getTime(date)

        this.eventCalculation(false, date)

        if (this.onTime() < this.minimumOnTime) {
            return false
        }

        if (this.actualEnd < this.actualStart) {
            return this.wrapMidnight && ((currentTime < this.actualEnd) || (currentTime > this.actualStart))
        }
        return (currentTime > this.actualStart) && (currentTime < this.actualEnd)
    }

    /**
     * Check how the operational status is today,
     * returns 'normal' in case of normal operation or 'noMinomumOnTime' / 'noMidnightWrap' if we do not turn on today
     * @returns
     */
    public operationToday(): 'normal' | 'minimumOnTimeNotMet' | 'noMidnightWrap' {
        const onTime = this.onTime()

        if (onTime >= 0 && onTime < this.minimumOnTime) {
            return 'minimumOnTimeNotMet'
        }

        return !this.wrapMidnight && (this.actualEnd < this.actualStart) ? 'noMidnightWrap' : 'normal'
    }

    private eventCalculation(forceUpdate = false, now = new Date()) {
        this.updateSunCalc(now)
        if (!forceUpdate && this.lastRecalcTime === now.getDate()) {
            return
        }
        this.lastRecalcTime = now.getDate()
        this.actualStart = this.lookupEventTime(this.startTime) + this.startOffset
        this.actualEnd = this.lookupEventTime(this.endTime, this.actualStart) + this.endOffset
    }

    /**
     * Converts date to internal time format
     * @param date
     * @returns
     */
    private getTime(date: Date): number {
        return date.getHours() * 60 + date.getMinutes()
    }

    private lookupEventTime(time: number, startTime = 0): number {
        if (time <= wholeDay) {
            return time
        }

        if (this.latitude === undefined && this.longitude === undefined) {
            throw new Error('Something went wrong, latitude and longitude not specified')
        }

        if (time > 10000) {
            return (startTime + (time - 10000)) % wholeDay
        }

        const lookedUptime = this.getSunOrMoonTime(time)
        if (!lookedUptime) {
            throw new Error(`Can't look up the correct time '${time}' '${startTime}'`)
        }

        return this.getTime(lookedUptime)
    }
}
