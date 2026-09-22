import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { Public } from './common/decorators/public.decorator';

// Sans ceci, GET / renvoie un 404 brut ("Cannot GET /") — déroutant pour
// quiconque ouvre juste localhost:3000 dans un navigateur pour vérifier que
// l'API tourne. On redirige vers la documentation Swagger, seule page
// pensée pour être consultée par un humain.
@Controller()
export class AppController {
  @Public()
  @Get()
  @ApiExcludeEndpoint()
  public root(@Res() reply: FastifyReply): void {
    reply.redirect('/api/docs', 302);
  }
}
