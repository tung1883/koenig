const getErrorMessage = (err) => {
    if (!err) return 'Unknown error'
    if (typeof err === 'string') return err
    return err.message || 'Unknown error'
}

exports.errorHandler = (err, res, status = 400) => {
    console.log(err)
    return res.status(status).send({
        error: getErrorMessage(err)
    })
}

exports.getErrorMessage = getErrorMessage
