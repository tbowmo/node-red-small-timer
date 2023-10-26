import { expect } from 'chai'
import { capitalizeFirstLetter, isNotUndefinedOrNull } from './utils'

describe('lib/utils', () => {
    it('should capitalize first letter of string', () => {
        const testString = 'quick brown fox'

        expect(capitalizeFirstLetter(testString)).to.equal('Quick brown fox')
    })

    it('should return false on null or undefined', () => {
        expect(isNotUndefinedOrNull(null)).to.equal(false)
        expect(isNotUndefinedOrNull(0)).to.equal(true)
        expect(isNotUndefinedOrNull(undefined)).to.equal(false)
        expect(isNotUndefinedOrNull('')).to.equal(true)
    })
})
