export function isNotUndefinedOrNull<T>(input: T): input is NonNullable<T> {
    return input !== undefined && input !== null
}

export function capitalizeFirstLetter(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1)
}
