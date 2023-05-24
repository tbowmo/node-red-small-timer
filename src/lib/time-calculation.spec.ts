import { expect } from 'chai'
import { useSinonSandbox } from '../../test'
import { TimeCalc } from './time-calculation'
import sunCalc from 'suncalc'

describe('lib/time-calculation', () => {
    const sinon = useSinonSandbox()

    function setupTest() {
        const getMoonTimes = sinon.stub(sunCalc, 'getMoonTimes').returns({
            rise: new Date('2023-01-01 11:00'),
            set: new Date('2023-01-01 12:00')
        })
        const getTimes = sinon.stub(sunCalc, 'getTimes').returns({
            nightEnd: new Date('2023-01-01 04:00'),
            sunrise: new Date('2023-01-01 05:00'),
            dawn: new Date('2023-01-01 06:00'),
            solarNoon: new Date('2023-01-01 11:00'),
            sunset: new Date('2023-01-01 19:00'),
            dusk: new Date('2023-01-01 21:00'),
            night: new Date('2023-01-01 23:00'),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)

        return {
            getMoonTimes,
            getTimes,
        }
    }

    it('should do basic on the hour on / off detection', () => {
        const stubs = setupTest()
        const currentTime = new Date('2023-01-01 11:00')
        sinon.clock.setSystemTime(currentTime)
        const minutes = currentTime.getHours() * 60 + currentTime.getMinutes()

        const timeCalc = new TimeCalc(
            10,
            10,
            false,
            minutes - 120, // 09:00
            minutes + 120, // 12:00
            0,
            0
        )

        sinon.assert.calledWith(stubs.getTimes, currentTime, 10, 10)
        expect(timeCalc.getOnState()).to.equal(true)
        expect(timeCalc.getTimeToNextStartEvent()).to.equal(1320)
        expect(timeCalc.getTimeToNextEndEvent()).to.equal(120)

        timeCalc.setStartEndTime(minutes + 120, minutes + 180, -5, -10)
        expect(timeCalc.getOnState()).to.equal(false)
        expect(timeCalc.getTimeToNextStartEvent()).to.equal(115)
        expect(timeCalc.getTimeToNextEndEvent()).to.equal(170)
    })

    it('should wrap around midnight', () => {
        setupTest()
        const currentTime = new Date('2023-01-01 01:00')
        sinon.clock.setSystemTime(currentTime)
        const timeCalc = new TimeCalc(
            10,
            10,
            true,
            5005,
            5006,
            0,
            0
        )

        expect(timeCalc.getOnState()).to.equal(true)
        expect(timeCalc.getTimeToNextEndEvent()).to.equal(180)
        expect(timeCalc.getTimeToNextStartEvent()).to.equal(22 * 60)
        expect(timeCalc.noOnStateToday()).to.equal(false)
    })

    it('should not signal on, if off time is before on time', () => {
        setupTest()
        const currentTime = new Date('2023-01-01 01:00')
        sinon.clock.setSystemTime(currentTime)
        const timeCalc = new TimeCalc(
            10,
            10,
            false,
            5005,
            5006,
            0,
            0
        )

        expect(timeCalc.getOnState()).to.equal(false)
        expect(timeCalc.getTimeToNextEndEvent()).to.equal(180)
        expect(timeCalc.getTimeToNextStartEvent()).to.equal(22 * 60)
        expect(timeCalc.noOnStateToday()).to.equal(true)
    })

    const testData: {
        startTime: number,
        endTime: number,
        wrap: boolean,
        expectedStart: number,
        expectedEnd: number
    }[] = [
        // dawn / dusk - 06:00 / 21:00
        { startTime: 5000, endTime: 5001, wrap: false, expectedStart: 1080, expectedEnd: 540 },
        // sunrise / solarNoon - 05:00 / 11:00
        { startTime: 5003, endTime: 5002, wrap: false, expectedStart: 1020, expectedEnd: 1380 },
        // sunset / night - 19:00 / 23:00
        { startTime: 5004, endTime: 5005, wrap: false, expectedStart: 420, expectedEnd: 660 },
        // nightEnd / moonrise - 123:00 / 11:00
        { startTime: 5006, endTime: 5007, wrap: false, expectedStart: 960, expectedEnd: 1380 },
        // moonset / dawn - :00 / :00
        { startTime: 5008, endTime: 5000, wrap: false, expectedStart: 0, expectedEnd: 1080 },
        { startTime: 13 * 60, endTime: 10090, wrap: false, expectedStart: 60, expectedEnd: 150 }
    ]

    testData.forEach((data) => {
        it(`should use start ${data.startTime} and end ${data.endTime}`, () => {
            setupTest()
            sinon.clock.setSystemTime(new Date('2023-01-01 12:00'))
            const timeCalc = new TimeCalc(
                10,
                10,
                data.wrap,
                data.startTime,
                data.endTime,
                0,
                0
            )

            expect(timeCalc.getTimeToNextStartEvent()).to.equal(data.expectedStart, 'startEvent')
            expect(timeCalc.getTimeToNextEndEvent()).to.equal(data.expectedEnd, 'endTime')
        })
    })

    it('should handle that moon time set rise could be false', () => {
        const stubs = setupTest()
        sinon.clock.setSystemTime(new Date('2023-01-01 12:05'))
        stubs.getMoonTimes.returns({
            rise: false,
            set: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)

        const timeCalc = new TimeCalc(
            10,
            10,
            false,
            5007,
            5008,
            0,
            0
        )

        expect(timeCalc.getTimeToNextStartEvent()).to.equal(715, 'startEvent')
        expect(timeCalc.getTimeToNextEndEvent()).to.equal(715, 'endTime')
    })

    it('should throw error if time can not be looked up', () => {
        setupTest()
        sinon.clock.setSystemTime(new Date('2023-01-01 13:00'))

        const timeCalc = new TimeCalc(
            10,
            10,
            true,
            5000,
            5001,
            0,
            0,
        )

        expect(timeCalc.setStartEndTime.bind(timeCalc, 6001, 6002))
            .to.throw('Can\'t look up the correct time \'6001\' \'0\'')
    })

    it('should create data suitable for debug', () => {
        setupTest()
        sinon.clock.setSystemTime(new Date('2023-01-01 13:00'))
        const timeCalc = new TimeCalc(
            10,
            10,
            true,
            5001,
            5002,
            0,
            0
        )

        expect(timeCalc.debug()).to.deep.equal({
            moonTimes: {
                rise: 660,
                set: 720,
            },
            now: 780,
            sunTimes: {
                dawn: 360,
                dusk: 1260,
                night: 1380,
                nightEnd: 240,
                solarNoon: 660,
                sunrise: 300,
                sunset: 1140
            },
            nextEnd: 1320,
            nextStart: 480,
            noOnStateToday: false,

            actualEnd: 660,
            actualStart: 1260,
            onState: false,

        })
    })
})
