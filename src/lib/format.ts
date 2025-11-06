export const formatNumeric = (value?: number, decimals = 2) => {
	if (value === undefined) {
		return '––'
	}

	if (isNaN(value)) {
		return 'NaN'
	}

	if (value === Number.POSITIVE_INFINITY) {
		return '+∞'
	}

	if (value === Number.NEGATIVE_INFINITY) {
		return '-∞'
	}

	return value.toFixed(decimals)
}
