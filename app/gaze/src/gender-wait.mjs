// An image the worker found faces in before its gender model loaded.
// The page must not apply that answer: applying it with no gender reads
// flags every face (both genders covered, and cached that way). It keeps
// the image covered and asks again once the model is in.
export function needsGenderWait(res) {
  return !!(res && res.genderPending && res.boxes && res.boxes.length);
}
