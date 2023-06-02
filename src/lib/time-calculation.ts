import SunCalc from 'suncalc'

type MoonTimes = keyof SunCalc.GetMoonTimes
type SunTimes = keyof SunCalc.GetTimesResult
type MoonAndSun = SunTimes | MoonTimes

const wholeDay = 1440 // Whole day in minutes

function isNotUndefined<T>(input: T): input is Exclude<T, undefined> {
    return input !== undefined
}

/**
 * Encapsulates logic for start and end times, including dynamically adjusted times (sunset, sunrise etc)
 */
export class TimeCalc {

    // times from suncalc, depends on latitude / longitude and time of year
    private sunTimes: SunCalc.GetTimesResult | undefined = undefined
    private moonTimes: SunCalc.GetMoonTimes | undefined = undefined

    private sunLookup: { [key: number]: MoonAndSun } = {
        // legacy
        5000: 'dawn',
        5001: 'dusk',
        5002: 'solarNoon',
        5003: 'sunrise',
        5004: 'sunset',
        5005: 'night',
        5006: 'nightEnd',
        5007: 'rise',
        5008: 'set',
        // new
        // 5101: 'sunrise',
        // 5102: 'sunriseEnd',
        // 5103: 'goldenHourEnd',
        // 5104: 'solarNoon',
        // 5105: 'goldenHour',
        // 5106: 'sunsetStart',
        // 5107: 'sunset',
        // 5108: 'dusk',
        // 5109: 'nauticalDusk',
        // 5110: 'night',
        // 5111: 'nadir',
        // 5112: 'nightEnd',
        // 5113: 'nauticalDawn',
        // 5114: 'dawn',
        // 5115: 'rise', // moon
        // 5116: 'set', // moon
    }

    private lastSunCalcUpdate = -1
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
        private latitude: number,
        private longitude: number,
        private wrapMidnight: boolean,
        private startTime: number,
        private endTime: number,
        private startOffset: number,
        private endOffset: number,
    ) {
        this.eventCalculation()
    }

    private convertDateToTime<
        T extends (SunCalc.GetTimesResult | SunCalc.GetMoonTimes),
        P extends keyof T
    >(
        times: T | undefined,
    ): Record<string, number> {
        return Object.fromEntries(Object.values(this.sunLookup)
            .map((key) => {
                if (times && (key in times)) {
                    return [key, this.getTime(times[(key as P)] as Date)]
                }
            })
            .filter(isNotUndefined))
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
            noOnStateToday: this.noOnStateToday(),
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

    /**
     * Returns the actual on state, according to the current time
     *
     * @param date optional date
     * @returns
     */
    public getOnState(date = new Date()): boolean {
        const currentTime = this.getTime(date)

        this.eventCalculation(false, date)

        if (this.actualEnd < this.actualStart) {
            return this.wrapMidnight && ((currentTime < this.actualEnd) || (currentTime > this.actualStart))
        }
        return (currentTime > this.actualStart) && (currentTime < this.actualEnd)
    }

    /**
     * Check if we will have an on event today,
     * returns false if wrapMidnight is false, and actualEnd is before actualStart
     * @returns
     */
    public noOnStateToday(): boolean {
        return !this.wrapMidnight && (this.actualEnd < this.actualStart)
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

    private updateSunCalc(now = new Date()) {
        // Only necessary to do the calculations once a day
        if (this.lastSunCalcUpdate === now.getDay()) {
            return
        }

        this.lastSunCalcUpdate = now.getDay()
        this.sunTimes = SunCalc.getTimes(now, this.latitude, this.longitude)
        this.moonTimes = SunCalc.getMoonTimes(now, this.latitude, this.longitude)
    }

    private lookupEventTime(time: number, startTime = 0): number {
        if (time <= wholeDay) {
            return time
        }

        if (time > 10000) {
            return (startTime + (time - 10000)) % wholeDay
        }

        const v = this.sunLookup[time]

        if (this.sunTimes && v in this.sunTimes) {
            const z = this.sunTimes[(v as SunTimes)]
            return (this.getTime(z))
        }

        if (this.moonTimes && v in this.moonTimes) {
            const z = this.moonTimes[(v as MoonTimes)]
            if (typeof z === 'object') {
                return this.getTime(z)
            }
            return v === 'set' ? wholeDay : 0
        }

        throw new Error(`Can't look up the correct time '${time}' '${startTime}'`)
    }
}
