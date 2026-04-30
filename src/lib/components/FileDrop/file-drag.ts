export const hasDraggedFiles = (dataTransfer: DataTransfer | null): boolean => {
	return [...(dataTransfer?.types ?? [])].includes('Files')
}
