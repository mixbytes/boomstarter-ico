import '../helpers/typeExt';


export function assertBigNumberEqual(actual, expected, message=undefined) {
    assert(actual.eq(expected), "{2}expected {0}, but got: {1}".format(expected, actual,
        message ? message + ': ' : ''));
}
