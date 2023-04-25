import SunCalc from 'suncalc'
import { hoursToMinutes } from 'date-fns'

/**
 * Encapsulates logic for start and end times, including dynamically adjusted times (sunset, sunrise etc)
 */
export class TimeCalc {

    // times from suncalc, depends on latitude / longitude and time of year
    private dawn = 0
    private dusk = 0
    private moonrise = 0
    private moonset = 0
    private night = 0
    private nightEnd = 0
    private solarNoon = 0
    private sunrise = 0
    private sunset = 0

    private lastSuncalcUpdate = -1
    private actualStart = 0
    private actualEnd = 0

    /**
     *
     * @param latitude
     * @param longitude
     * @param wrapMidnight
     */
    constructor (
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
        this.startTime = startTime ?? this.startTime,
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
        const currentTime = date.getHours() * 60 + date.getMinutes()
        const nextEvent = this.actualStart - currentTime
        return nextEvent >= 0 ? nextEvent : nextEvent + 1440
    }

    /**
     * Get number of minutes to next end event, will add 24 hours if negative
     * @param date optional date object
     * @returns
     */
    public getMinutesToNextEndEvent(date = new Date()): number {
        const currentTime = date.getHours() * 60 + date.getMinutes()
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

    private updateSunCalc(now = new Date()) {
        // Only necessary to do the calculations once a day
        if (this.lastSuncalcUpdate === now.getDay()) {
            return
        }

        this.lastSuncalcUpdate = now.getDay()
        const times = SunCalc.getTimes(now, this.latitude, this.longitude)
        const moons = SunCalc.getMoonTimes(now, this.latitude, this.longitude)

        this.dawn = (times.dawn.getHours() * 60) + times.dawn.getMinutes()
        this.dusk = (times.dusk.getHours() * 60) + times.dusk.getMinutes()

        this.solarNoon = (times.solarNoon.getHours() * 60) + times.solarNoon.getMinutes()

        this.sunrise = (times.sunrise.getHours() * 60) + times.sunrise.getMinutes()
        this.sunset = (times.sunset.getHours() * 60) + times.sunset.getMinutes()

        if (typeof moons.rise === undefined) {
            this.moonrise = 1440
        } else {
            const date = moons.rise
            this.moonrise = (date.getHours() * 60) + date.getMinutes()
        }

        if (typeof moons.set === undefined) {
            this.moonset = 0
        } else {
            const date = moons.set
            this.moonset = (date.getHours() * 60) + date.getMinutes()
        }

        this.night = (times.night.getHours() * 60) + times.night.getMinutes()
        this.nightEnd = (times.nightEnd.getHours() * 60) + times.nightEnd.getMinutes()
    }


    // eslint-disable-next-line complexity
    private lookupEventTime(time: number, startTime = 0): number {
        if (time <= 1440) {
            return time
        }

        if (time > 10000) {
            return (startTime + (time - 10000)) % 1440
        }

        switch (time) {
            case 5000:
                return this.dawn
            case 5001:
                return this.dusk
            case 5002:
                return this.solarNoon
            case 5003:
                return this.sunrise
            case 5004:
                return this.sunset
            case 5005:
                return this.night
            case 5006:
                return this.nightEnd
            case 5007:
                return this.moonrise
            case 5008:
                return this.moonset
        }

        throw new Error('Time is more than 1440 (60*24)')
    }
}
