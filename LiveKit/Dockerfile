# syntax=docker/dockerfile:1

ARG RUNTIME_BASE=node:22-alpine
FROM ${RUNTIME_BASE} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY public ./public
COPY prisma ./prisma
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY docker/entrypoint.sh ./docker/entrypoint.sh

RUN chmod +x ./docker/entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker/entrypoint.sh"]
CMD ["node", "server.js"]
