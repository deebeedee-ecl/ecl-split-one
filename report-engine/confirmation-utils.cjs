const MAX_CONFIRMATION_ATTEMPTS = 3;

function shouldRetryConfirmation(attempts, httpStatus) {
  if (attempts >= MAX_CONFIRMATION_ATTEMPTS) return false;
  return (
    !httpStatus ||
    httpStatus >= 500 ||
    httpStatus === 401 ||
    httpStatus === 403 ||
    httpStatus === 408 ||
    httpStatus === 429
  );
}

module.exports = {
  MAX_CONFIRMATION_ATTEMPTS,
  shouldRetryConfirmation,
};
