export function isNotUndefinedOrNull<T>(input: T): input is NonNullable<T> {
    return input !== undefined && input !== null
}

export function capitalizeFirstLetter(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1)
}

export function isDefinedAndNotEmpty(input: number | string | undefined | null): input is string {
    return isNotUndefinedOrNull(input) && input !== ''
}
