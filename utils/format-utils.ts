export function formatFileNameAsTitle(fileName: string):
string {
    // remove file extension and replace special characters with spaces
    const withoutExtension = fileName.replace(/\.[^/.]+$/,'');
    const withSpaces = withoutExtension
    .replace(/[-_]+/g,' ') //replace dashes ad underscores with spaces
    .replace(/([a-z])([A_Z])/g, '$1 $2');//add space between camel cases


    //convert to title case (Capitalize first letter of each word)
    return withSpaces
    .split( ' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join( ' ')
     .trim()

}