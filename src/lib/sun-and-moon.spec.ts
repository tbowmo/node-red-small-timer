import { expect } from 'chai'
import { SunAndMoon } from './sun-and-moon'
import { useSinonSandbox } from '../../test'
import sunCalc from 'suncalc'

describe('lib/sun-and-moon', () => {
    const sinon = useSinonSandbox()

    function setupTest() {
        const getMoonTimes = sinon.stub(sunCalc, 'getMoonTimes').returns({
            rise: new Date('2023-01-01 11:00'),
            set: new Date('2023-01-01 12:00'),
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

    it('should return list for ui with label and dates', () => {
        setupTest()

        const sunAndMoon = new SunAndMoon(
            10,
            10,
        )

        expect(sunAndMoon.getTimes()).to.deep.equal([
            {
                'date': new Date('2023-01-01 05:00'),
                'id': '5101',
                'label': 'Sunrise',
            },
            {
                'date': new Date('2023-01-01 11:00'),
                'id': '5104',
                'label': 'Solar noon',
            },
            {
                'date': new Date('2023-01-01 19:00'),
                'id': '5107',
                'label': 'Sunset',
            },
            {
                'date': new Date('2023-01-01 21:00'),
                'id': '5108',
                'label': 'Dusk',
            },
            {
                'date': new Date('2023-01-01 23:00'),
                'id': '5110',
                'label': 'Night',
            },
            {
                'date': new Date('2023-01-01 04:00'),
                'id': '5112',
                'label': 'Night end',
            },
            {
                'date': new Date('2023-01-01 06:00'),
                'id': '5114',
                'label': 'Dawn',
            },
            {
                'date': new Date('2023-01-01 11:00'),
                'id': '5115',
                'label': 'Moonrise',
            },
            {
                'date': new Date('2023-01-01 12:00'),
                'id': '5116',
                'label': 'Moonset',
            },
           
        ])
    })
})
