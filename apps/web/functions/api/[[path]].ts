export const onRequest: PagesFunction<{ BACKEND: Fetcher }> = ({
  request,
  env,
}) => env.BACKEND.fetch(request);
