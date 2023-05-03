import SunCalc from 'suncalc'
import { hoursToMinutes } from 'date-fns'

type MoonTimes = keyof SunCalc.GetMoonTimes
type SunTimes = keyof SunCalc.GetTimesResult
type MoonAndSun = SunTimes | MoonTimes

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
        5101: 'sunrise',
        5102: 'sunriseEnd',
        5103: 'goldenHourEnd',
        5104: 'solarNoon',
        5105: 'goldenHour',
        5106: 'sunsetStart',
        5107: 'sunset',
        5108: 'dusk',
        5109: 'nauticalDusk',
        5110: 'night',
        5111: 'nadir',
        5112: 'nightEnd',
        5113: 'nauticalDawn',
        5114: 'dawn',
        5115: 'rise', // moon
        5116: 'set', // moon
    }

    private lastSuncalcUpdate = -1
    private actualStart = 0
    private actualEnd = 0

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


    public setStartEndTime(startTime?: number, endTime?: number, startOffset?: number, endOffset?: number) {
        this.startTime = startTime ?? this.startTime
        this.endTime = endTime ?? this.endTime
        this.startOffset = startOffset ?? this.startOffset
        this.endOffset = endOffset ?? this.endOffset
        this.eventCalculation()
    }

    /**
     * Get number of minutes to next start event. Will add 24 hours if negative
     * @param date optional date object
     * @returns
     */
    public getMinutesToNextStartEvent(date = new Date()): number {
        const currentTime = this.getMinutes(date)
        const nextEvent = this.actualStart - currentTime
        return nextEvent >= 0 ? nextEvent : nextEvent + 1440
    }

    /**
     * Get number of minutes to next end event, will add 24 hours if negative
     * @param date optional date object
     * @returns
     */
    public getMinutesToNextEndEvent(date = new Date()): number {
        const currentTime = this.getMinutes(date)
        const nextEvent = this.actualEnd - currentTime
        return nextEvent >= 0 ? nextEvent : nextEvent + 1440
    }

    /**
     * Returns the actual on state, according to the current time
     *
     * @param date optional date
     * @returns
     */
    public getOnState(date = new Date()): boolean {
        const currentTime = hoursToMinutes(date.getHours()) + date.getMinutes()
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

    public eventCalculation(now = new Date()) {
        this.updateSunCalc(now)
        this.actualStart = this.lookupEventTime(this.startTime) + this.startOffset
        this.actualEnd = this.lookupEventTime(this.endTime, this.actualStart) + this.endOffset
    }

    private getMinutes(date: Date): number {
        return date.getHours() * 60 + date.getMinutes()
    }

    private updateSunCalc(now = new Date()) {
        // Only necessary to do the calculations once a day
        if (this.lastSuncalcUpdate === now.getDay()) {
            return
        }

        this.lastSuncalcUpdate = now.getDay()
        this.sunTimes = SunCalc.getTimes(now, this.latitude, this.longitude)
        this.moonTimes = SunCalc.getMoonTimes(now, this.latitude, this.longitude)
    }

    private lookupEventTime(time: number, startTime = 0): number {
        if (time <= 1440) {
            return time
        }

        if (time > 10000) {
            return (startTime + (time - 10000)) % 1440
        }

        const v = this.sunLookup[time]

        if (this.sunTimes && v in this.sunTimes) {
            const z = this.sunTimes[(v as SunTimes)]
            return (this.getMinutes(z))
        }

        if (this.moonTimes && v in this.moonTimes) {
            const z = this.moonTimes[(v as MoonTimes)]
            return typeof z === 'object'
                ? this.getMinutes(z)
                : (v === 'set' ? 1440 : 0)
        }

        throw new Error('Time is more than 1440 (60*24)')
    }
}
