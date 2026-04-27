self.__MIDDLEWARE_MATCHERS = [
  {
    "regexp": "^(?:\\/(_next\\/data\\/[^/]{1,}))?(?:\\/((?!api\\/webhooks\\/stripe|api\\/webhooks\\/resend\\/inbound|_next\\/static|_next\\/image|favicon.ico).*))(\\\\.json)?[\\/#\\?]?$",
    "originalSource": "/((?!api/webhooks/stripe|api/webhooks/resend/inbound|_next/static|_next/image|favicon.ico).*)"
  }
];self.__MIDDLEWARE_MATCHERS_CB && self.__MIDDLEWARE_MATCHERS_CB()