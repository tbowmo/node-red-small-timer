import { endOfDay, startOfDay } from 'date-fns'
import SunCalc from 'suncalc'
import { capitalizeFirstLetter, isNotUndefinedOrNull } from './utils'

type MoonTimes = keyof SunCalc.GetMoonTimes
type SunTimes = keyof SunCalc.GetTimesResult
type MoonAndSun = SunTimes | MoonTimes


/**
 * Encapsulates logic for start and end times, including dynamically adjusted times (sunset, sunrise etc)
 */
export class SunAndMoon {

    // times from suncalc, depends on latitude / longitude and time of year
    protected sunTimes: SunCalc.GetTimesResult | undefined = undefined
    protected moonTimes: SunCalc.GetMoonTimes | undefined = undefined
    private lastSunCalcUpdate = -1

    protected sunLookup: { [key: number]: MoonAndSun } = {
        5000: 'dawn',
        5001: 'dusk',
        5002: 'solarNoon',
        5003: 'sunrise',
        5004: 'sunset',
        5005: 'night',
        5006: 'nightEnd',
        5007: 'rise',
        5008: 'set',

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

    /**
     *
     * @param latitude
     * @param longitude
     * @param wrapMidnight
     */
    constructor(
        protected latitude?: number,
        protected longitude?: number,
    ) {
    }

    public getTimes(now = new Date()): {id: string, label: string, date: Date}[] {
        if (!this.latitude || !this.longitude) {
            return []
        }
        this.sunTimes = SunCalc.getTimes(now, this.latitude, this.longitude)
        this.moonTimes = SunCalc.getMoonTimes(now, this.latitude, this.longitude)

        return Object.entries(this.sunLookup).map(([id, key]) => {
            if (Number(id) < 5100) {
                return
            }
            const labelParts = key.split(/(?=[A-Z])/)
            let label = labelParts.join(' ').toLocaleLowerCase()
            if (this.sunTimes && key in this.sunTimes) {
                label = capitalizeFirstLetter(label)
                const date = this.sunTimes[(key as SunTimes)]
                return {id, label, date}
            }

            if (this.moonTimes && key in this.moonTimes) {
                label = `Moon${label}`
                const date = this.moonTimes[(key as MoonTimes)]
                if (typeof date === 'object') {
                    return {id, label, date}
                } else {
                    return {id, label, date: key === 'rise' ? startOfDay(Date.now()) : endOfDay(Date.now())}
                }
            }
        }).filter(isNotUndefinedOrNull)
    }

    public getSunOrMoonTime(time: number, now = new Date()): Date | undefined{
        const v = this.sunLookup[time]

        if (this.sunTimes && v in this.sunTimes) {
            const z = this.sunTimes[(v as SunTimes)]
            return z
        }

        if (this.moonTimes && v in this.moonTimes) {
            const z = this.moonTimes[(v as MoonTimes)]
            if (typeof z === 'object') {
                return z
            }
            return v === 'set' ? startOfDay(now) : endOfDay(now)
        }
        return undefined
    }

    protected updateSunCalc(now = new Date()) {
        // Only necessary to do the calculations once a day
        if (this.lastSunCalcUpdate === now.getDay() || !this.latitude || !this.longitude) {
            return
        }

        this.lastSunCalcUpdate = now.getDay()
        this.sunTimes = SunCalc.getTimes(now, this.latitude, this.longitude)
        this.moonTimes = SunCalc.getMoonTimes(now, this.latitude, this.longitude)
    }
}
