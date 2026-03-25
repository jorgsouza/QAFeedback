package model

import (
	"fmt"
	"micro-frontend-gateway/helpers"
	"os"

	"github.com/valyala/fasthttp"
)

/*
* Aqui ficam o mapa contendo todas as rotas (exclindo as rotas de assets)
* Como usar:
* Path: string contendo o caminho que será feito o Matching da rota
* ProxyPass: Objeto do ProxyPass (Micro serviço)
* RedirectFunc: Esse parâmetro espera uma função que retorne a URL e o status code
* RewriteConf: Reescrita da rota que irá ser chamada no proxy. Ver exemplo abaixo
 */
func GetRoutes() []RouteConfig {
	buscaProxyPass := RaichuSite
	if enableSearchArea == "true" {
		buscaProxyPass = RASearchArea
	}

	return []RouteConfig{
		{
			Path:      `/`,
			ProxyPass: RAContent,
		},
		{
			Path:      `/compare/`,
			ProxyPass: RACompare,
		},
		{
			Path: `/compare/{rest:*}/`,
			RewriteConf: &helpers.RewriteConf{
				RewriteFrom: `/(.*)/`,
				RewriteTo:   `/$1`,
			},
			ProxyPass: RACompare,
		},
		{
			Path:      `/compare/api/company`,
			ProxyPass: RACompare,
		},

		{
			Path: `/404/`,
			RedirectFunc: func(ctx *fasthttp.RequestCtx) (string, int) {
				return "", notFound
			},
		},
		{
			Path:      `/api/cloudLogginWinston/`,
			Method:    "POST",
			ProxyPass: PublicArea,
		},
		{
			Path:      `/api/complainer-detection/`,
			Method:    "POST",
			ProxyPass: PublicArea,
		},
		{
			Path:      `/api/authentication/`,
			Method:    "POST",
			ProxyPass: PublicArea,
		},
		{
			Path:      `/blackfriday/`,
			ProxyPass: PublicArea,
		},
		{
			Path:         `/detector-site/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(ReclameAquiURL, `/detector-site-confiavel/`), movedPermanently),
		},
		{
			Path:         `/categoria/agencia-de-viagens/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(ReclameAquiURL, `/segmentos/turismo-e-lazer/agencias-de-viagens/`), movedPermanently),
		},
		{
			Path:      `/detector-site-confiavel/`,
			ProxyPass: RADetectorSites,
		},
		{
			Path:      `/detector-site-confiavel/{rest:*}`,
			ProxyPass: RADetectorSites,
		},
		{
			Path:      `/premio/`,
			ProxyPass: PremioRA,
		},
		{
			Path:      `/premio/sobre-premio/`,
			ProxyPass: PremioRA,
		},
		{
			Path:      `/premio/classificadas-indicadas/`,
			ProxyPass: PremioRA,
		},
		{
			Path:      `/premio/classificadas-indicadas/{rest:*}/`,
			ProxyPass: PremioRA,
		},
		{
			Path:      `/premio/votacao/`,
			ProxyPass: VotingPremioRA,
		},
		{
			Path:      `/premio/resultados/`,
			ProxyPass: PremioRA,
		},
		{
			Path:      `/premio/resultados/{rest:*}/`,
			ProxyPass: PremioRA,
		},
		{
			Path:      `/premio/{year}/fotos/`,
			ProxyPass: PremioRA,
		},
		// Comentado para investigação desse redirect
		// {
		// 	Path: `/premio/votacao/{shortname}/`,
		// 	RewriteConf: &helpers.RewriteConf{
		// 		RewriteFrom: `/premio/votacao/(.*)/`,
		// 		RewriteTo:   `/premio/votacao/empresa/$1/`,
		// 	},
		// 	ProxyPass: VotingPremioRA,
		// },
		{
			Path:      `/premio/votacao/{rest:*}/`,
			ProxyPass: VotingPremioRA,
		},
		{
			Path:         `/premio/indicadas/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(os.Getenv("HOST_FULL_RECLAMEAQUI"), "/premio/classificadas-indicadas/"), movedPermanently),
		},
		{
			Path:         `/premio/indicadas/{rest:*}/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(os.Getenv("HOST_FULL_RECLAMEAQUI"), "/premio/classificadas-indicadas/"), movedPermanently),
		},
		{
			Path:         `/premio/resultado/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(os.Getenv("HOST_FULL_RECLAMEAQUI"), "/premio/resultados/"), movedPermanently),
		},
		{
			Path:         `/premio/resultado/{rest:*}/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(os.Getenv("HOST_FULL_RECLAMEAQUI"), "/premio/resultados/"), movedPermanently),
		},
		{
			Path:         `/premio/inscricao/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(os.Getenv("HOST_FULL_RECLAMEAQUI"), "/login/empresa/?redirectUrl=", os.Getenv("HOST_FULL_RECLAMEAQUI"), "/area-da-empresa/premio/"), movedPermanently),
		},
		{
			Path:         `/premio/area-da-empresa/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(os.Getenv("HOST_FULL_RECLAMEAQUI"), "/area-da-empresa/premio/"), movedPermanently),
		},
		{
			Path:         `/premio/area-da-empresa/{rest:*}/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(os.Getenv("HOST_FULL_RECLAMEAQUI"), "/area-da-empresa/premio/"), movedPermanently),
		},
		{
			Path:         `/premio/regulamento/`,
			RedirectFunc: helpers.RedirectUrl("https://storage.googleapis.com/premio-files/2026/regulamento.pdf", movedPermanently),
		},
		{
			Path:      `/premio/{rest:*}/`,
			ProxyPass: LegacyPremioRA,
		},
		{
			Path:         `/reclame/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(ReclameAquiURL, `/reclamar/`), movedPermanently),
		},
		{
			Path:         `/brand-page/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(ParaSuaEmpresaURL, `/brand-page`), movedPermanently),
		},
		{
			Path:         `/ra-api/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(ParaSuaEmpresaURL, `/ra-api`), movedPermanently),
		},
		{
			Path:         `/conflito-sem-conflito/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(ParaSuaEmpresaURL, `/conflito-sem-conflito`), movedPermanently),
		},
		{
			Path:         `/ra-verificada/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(ParaSuaEmpresaURL, `/ra-verificada`), movedPermanently),
		},
		{
			Path:         `/termos_de_uso/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(ReclameAquiURL, `/termos-de-uso`), movedPermanently),
		},

		{
			Path:         `/cursos/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(CursosReclameAquiURL, `/`), movedPermanently),
		},
		{
			Path:         `/b2b/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/empresa/{shortname}/premio/`,
			RedirectFunc: helpers.NewShortnameRedirect(1),
			RewriteConf: &helpers.RewriteConf{
				RewriteFrom: `/empresa/(.*)/premio/`,
				RewriteTo:   `/premio/indicadas/$1/`,
			},
			ProxyPass: LegacyPremioRA,
		},
		{
			Path:         fmt.Sprintf(`/empresa/{shortname:^(%s)$}/`, shortnameForBrandpage),
			RedirectFunc: helpers.NewShortnameRedirect(1),
			ProxyPass:    RABrandpage,
		},
		{
			Path:         `/empresa/{shortname:.*}/`,
			RedirectFunc: helpers.NewShortnameRedirect(1),
			ProxyPass:    PublicArea,
		},
		{
			Path:         `/empresa/{shortname:.*}/analise/`,
			RedirectFunc: helpers.NewShortnameRedirect(1),
			ProxyPass:    PublicArea,
		},
		{
			Path:         `/empresa/{shortname:.*}/cupons-de-desconto/`,
			RedirectFunc: helpers.NewShortnameRedirect(1),
			ProxyPass:    PublicArea,
		},
		{
			Path:      `/descontos/{rest:*}/`,
			ProxyPass: PublicArea,
		},
		{
			Path:      `/redirect/`,
			ProxyPass: PublicArea,
		},
		{
			Path:      `/loja-aplicativo/`,
			ProxyPass: PublicArea,
		},
		{
			Path:         `/empresa/{shortname:.*}/lista-reclamacoes/`,
			RedirectFunc: helpers.NewShortnameRedirect(1),
			ProxyPass:    PublicArea,
		},
		{
			Path:      `/extensao/{rest:*}/`,
			ProxyPass: PublicArea,
		},
		{
			Path:         `/extensao/instalacao/sucesso/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(ReclameAquiURL, `/login/`), movedPermanently),
		},
		{
			Path:         `/empresa/{shortname:.*}/{acao}/`,
			RedirectFunc: helpers.NewShortnameRedirect(1),
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/empresa/{shortname}/reviews-da-loja/`,
			RedirectFunc: helpers.NewShortnameRedirect(1),
			UsePrerender: true,
			ProxyPass:    PublicArea,
		},
		{
			Path:         `/empresa/{shortname}/reviews-da-loja/{nota:[a-zA-Z\-]+}/`,
			RedirectFunc: helpers.NewShortnameRedirect(1),
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},

		{
			Path:         `/empresa/{shortname}/marcas/{marca}/`,
			RedirectFunc: helpers.NewShortnameRedirect(1),
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/empresa/{shortname}/conteudos/`,
			RedirectFunc: helpers.NewShortnameRedirect(1),
			ProxyPass:    PublicArea,
		},
		{
			Path:         `/empresa/{shortname}/conteudos/{title_and_id}/`,
			RedirectFunc: helpers.NewShortnameRedirect(1),
			ProxyPass:    PublicArea,
		},

		{
			Path:         `/empresa/{shortname}/faq/`,
			RedirectFunc: helpers.NewShortnameRedirect(1),
			ProxyPass:    PublicArea,
		},
		{
			Path:         `/empresa/{shortname}/sobre/`,
			RedirectFunc: helpers.NewShortnameRedirect(1),
			ProxyPass:    PublicArea,
		},
		{
			Path:         `/empresa/{shortname}/faq/{title_and_id}/`,
			RedirectFunc: helpers.NewShortnameRedirect(1),
			ProxyPass:    PublicArea,
		},
		{
			Path:         `/cadastro-empresa/consumidor/`,
			UsePrerender: true,
			ProxyPass:    PublicArea,
		},
		{
			Path:         `/cadastro-de-empresa/`,
			UsePrerender: true,
			ProxyPass:    PublicArea,
			RedirectFunc: helpers.RedirectUrl(`/criar-pagina-empresa/`, movedPermanently),
		},
		{
			Path:      `/cadastro-de-empresa/biometria/`,
			ProxyPass: RACompanyRecovery,
		},
		{
			Path: `/criar-pagina-empresa/`,
			RewriteConf: &helpers.RewriteConf{
				RewriteFrom: `/criar-pagina-empresa/`,
				RewriteTo:   `/-cadastro-de-empresa/`,
			},
			ProxyPass: RACompanyRegistration,
		},
		{
			Path:      `/confirmation/`,
			ProxyPass: PublicArea,
		},
		{
			Path:         `/reclamar/`,
			UsePrerender: true,
			ProxyPass:    PublicArea,
		},
		{
			// fluxo de reclamação v2
			Path:         `/reclamar/v2/`,
			UsePrerender: true,
			ProxyPass:    RAComplaint,
		},
		{
			Path:      `/.well-known/apple-app-site-association/`,
			ProxyPass: PublicArea,
		},

		{
			Path:      `/.well-known/assetlinks.json`,
			ProxyPass: PublicArea,
		},
		{
			Path:         `/contato-privado/{id}/{rest:sucesso}/{complainID}/`,
			UsePrerender: true,
			ProxyPass:    PublicArea,
		},
		{
			Path:         `/reclamar/{id}/minha-historia/`,
			UsePrerender: true,
			ProxyPass:    RAComplaint,
		},
		{
			// fluxo de reclamação v2
			Path:         `/reclamar/v2/{id}/minha-historia/`,
			UsePrerender: true,
			ProxyPass:    RAComplaint,
		},
		{
			Path:         `/reclamar/{id}/contato-privado/`,
			UsePrerender: true,
			ProxyPass:    PublicArea,
		},
		{
			Path:         `/reclamar/{id}/{actions:contato-privado|ligacao}/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/reclamar/{id}/sucesso/{complainID}/`,
			UsePrerender: true,
			ProxyPass:    PublicArea,
		},
		{
			// fluxo de reclamação v2
			Path:         `/reclamar/v2/{id}/sucesso/{complainID}/`,
			UsePrerender: true,
			ProxyPass:    RAComplaint,
		},
		{
			Path:         `/reclamar/{id}/`,
			UsePrerender: true,
			ProxyPass:    PublicArea,
		},
		{
			// fluxo de reclamação v2
			Path:         `/reclamar/v2/{id}/`,
			UsePrerender: true,
			ProxyPass:    RAComplaint,
		},
		{
			Path:         `/chat/{id}/`,
			UsePrerender: true,
			ProxyPass:    PublicArea,
		},
		{
			Path:         `/chat/{rest:*}/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:              `/confieaqui/{rest:*}`,
			CopyHostFromProxy: true,
			ProxyPass:         ConfieAqui,
		},
		{
			Path:      `/confirmation-contact/`,
			ProxyPass: PublicArea,
		},
		// {
		// 	Path:         `/cadastro/empresa/`,
		// 	UsePrerender: true,
		// 	ProxyPass:    PublicArea,
		// },
		{
			Path: `/cadastro/consumidor/`,
			RewriteConf: &helpers.RewriteConf{
				RewriteFrom: `/_cadastro/consumidor/`,
				RewriteTo:   `/cadastro/consumidor/`,
			},
			ProxyPass: RARegistrations,
		},
		{
			Path: `/cadastro/consumidor/sucesso/`,
			RewriteConf: &helpers.RewriteConf{
				RewriteFrom: `/_cadastro/consumidor/`,
				RewriteTo:   `/cadastro/consumidor/`,
			},
			ProxyPass: RARegistrations,
		},
		{
			Path:         `/cadastro/sou-empresa/`,
			UsePrerender: true,
			ProxyPass:    PublicArea,
		},
		{
			Path:         `/cadastro/`,
			UsePrerender: true,
			ProxyPass:    PublicArea,
		},
		{
			Path:         `/login/`,
			UsePrerender: true,
			ProxyPass:    PublicArea,
		},
		{
			Path:         `/consumidor/login/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/entrar/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(os.Getenv("HOST_FULL_RECLAMEAQUI"), "/login/"), movedPermanently),
		},
		{
			Path:      `/area-da-empresa/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:         `/area-da-empresa/reclamacoes/encerradas-sem-avaliacao/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(os.Getenv("HOST_FULL_RECLAMEAQUI"), "/area-da-empresa/reclamacoes/todas/"), movedPermanently),
			ProxyPass:    LoggedArea,
		},
		{
			Path:      `/area-da-empresa/reclamacoes/{actions:todas|nao-respondidas|replicas|respondidas|avaliadas|duplicadas}/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:      `/area-da-empresa/reclamacoes/{id}/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:      `/area-da-empresa/moderar-ticket/{id}/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:      `/area-da-empresa/landing-page/{actions:analytics|publicacoes|faq|minha-pagina|call-to-action|meus-contatos|concorrentes|relatorio-de-impacto|ra-forms|alerta-de-crise|alertas}/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:         `/area-da-empresa/ra-analytics/performance-comparativa/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(ReclameAquiURL, `/area-da-empresa/ra-analytics/concorrentes/`), movedPermanently),
			ProxyPass:    LoggedArea,
		},
		{
			Path:         `/area-da-empresa/landing-page/performance-comparativa/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(ReclameAquiURL, `/area-da-empresa/landing-page/concorrentes/`), movedPermanently),
			ProxyPass:    LoggedArea,
		},
		{
			Path:      `/area-da-empresa/ra-forms/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:      `/area-da-empresa/suporte-exclusivo/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:      `/area-da-empresa/call-to-action/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:      `/area-da-empresa/gerenciamento-de-crise/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:      `/area-da-empresa/gerenciar-emails/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:      `/area-da-empresa/alterar-senha/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:      `/area-da-empresa/minha-pagina/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:      `/area-da-empresa/meus-contatos/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:      `/area-da-empresa/meu-endereco/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:         `/area-da-empresa/{bactions:tickets-duplicidade|tickets}/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(ReclameAquiURL, `/area-da-empresa/reclamacoes/nao-respondidas/`), movedPermanently),
		},
		{
			Path:      `/area-da-empresa/ra-analytics/{rest:*}/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:      `/area-da-empresa/faq/{rest:*}/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:      `/area-da-empresa/duvida-frequente/{rest:*}/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:      `/area-da-empresa/tutoriais/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:      `/area-da-empresa/tutoriais/{rest:*}/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:         `/area-da-empresa/produtos/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(ReclameAquiURL, `/area-da-empresa/produtos/produtos-ra/`), movedPermanently),
		},
		{
			Path:      `/area-da-empresa/produtos/produtos-ra/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:      `/area-da-empresa/produtos/meus-produtos/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:      `/area-da-empresa/compartilhar-reputacao/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:            `/area-da-empresa/alerta-de-crise/`,
			ProxyPass:       RAPublicationsPrivate,
			ResponseHeaders: map[string]string{"Cache-Control": "no-cache"},
		},
		{
			Path:            `/area-da-empresa/compartilhar-selo-rav/`,
			ProxyPass:       LoggedAreaWebapp,
			ResponseHeaders: map[string]string{"Cache-Control": "no-cache"},
		},
		{
			Path:            `/area-da-empresa/verificacao/`,
			ProxyPass:       LoggedAreaWebapp,
			ResponseHeaders: map[string]string{"Cache-Control": "no-cache"},
		},
		{
			Path:      `/area-da-empresa/assinatura-e-cobranca/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:      `/area-da-empresa/assinatura-e-cobranca/cancelamento`,
			ProxyPass: LoggedArea,
		},
		{
			Path:            `/area-da-empresa/meus-posts/`,
			ProxyPass:       RAPublicationsPrivate,
			ResponseHeaders: map[string]string{"Cache-Control": "no-cache"},
		},
		{
			Path:            `/area-da-empresa/publicacao/`,
			ProxyPass:       RAPublicationsPrivate,
			ResponseHeaders: map[string]string{"Cache-Control": "no-cache"},
		},
		{
			Path:            `/area-da-empresa/publicacao/{id}/`,
			ProxyPass:       RAPublicationsPrivate,
			ResponseHeaders: map[string]string{"Cache-Control": "no-cache"},
		},
		{
			Path:            `/area-da-empresa/personalizacao/ra-forms/`,
			ProxyPass:       RAFormsPrivate,
			ResponseHeaders: map[string]string{"Cache-Control": "no-cache"},
		},
		{
			Path:            `/area-da-empresa/personalizacao/ra-forms/{rest:*}`,
			ProxyPass:       RAFormsPrivate,
			ResponseHeaders: map[string]string{"Cache-Control": "no-cache"},
		},
		{
			Path:            `/area-da-empresa/personalizacao/segmentos/`,
			ProxyPass:       RACompanyPrivate,
			ResponseHeaders: map[string]string{"Cache-Control": "no-cache"},
		},
		{
			Path:            `/area-da-empresa/premio/`,
			ProxyPass:       PremioPrivate,
			ResponseHeaders: map[string]string{"Cache-Control": "no-cache"},
		},
		{
			Path:            `/area-da-empresa/premio/{rest:*}/`,
			ProxyPass:       PremioPrivate,
			ResponseHeaders: map[string]string{"Cache-Control": "no-cache"},
		},
		{
			Path:            `/area-da-empresa/gerenciar-usuarios/`,
			ProxyPass:       RACompanyPrivate,
			ResponseHeaders: map[string]string{"Cache-Control": "no-cache"},
		},
		{
			Path:            `/area-da-empresa/cadastrar-usuario/`,
			ProxyPass:       RACompanyPrivate,
			ResponseHeaders: map[string]string{"Cache-Control": "no-cache"},
		},
		{
			Path:            `/area-da-empresa/meu-perfil/`,
			ProxyPass:       RACompanyPrivate,
			ResponseHeaders: map[string]string{"Cache-Control": "no-cache"},
		},
		{
			Path:            `/area-da-empresa/perfil-do-usuario/{id}`,
			ProxyPass:       RACompanyPrivate,
			ResponseHeaders: map[string]string{"Cache-Control": "no-cache"},
		},
		{
			Path:            `/area-da-empresa/ra-reviews/`,
			ProxyPass:       RAReviewsPrivate,
			ResponseHeaders: map[string]string{"Cache-Control": "no-cache"},
		},
		{
			Path:            `/area-da-empresa/onboarding/steps/{rest:*}/`,
			ProxyPass:       HomePrivate,
			ResponseHeaders: map[string]string{"Cache-Control": "no-cache"}},
		{
			Path:            `/area-da-empresa/notificacoes/{rest:*}`,
			ProxyPass:       HomePrivate,
			ResponseHeaders: map[string]string{"Cache-Control": "no-cache"},
		},
		{
			Path:            `/gestao-de-empresa/completar-cadastro/`,
			ProxyPass:       RACompanyRegistration,
			ResponseHeaders: map[string]string{"Cache-Control": "no-cache"},
		},
		{
			Path:            `/gestao-de-empresa/escolher-empresa/`,
			ProxyPass:       RACompanyPrivate,
			ResponseHeaders: map[string]string{"Cache-Control": "no-cache"},
		},
		{
			Path:      `/gestao-de-empresa/convite-aceito/`,
			ProxyPass: RACompanyRegistration,
		},
		{
			Path:      `/gestao-de-empresa/convite-expirado/`,
			ProxyPass: RACompanyPrivate,
		},
		{
			Path:      `/login/empresa/`,
			ProxyPass: FrontAuth,
		},
		{
			Path:      `/login/consumidor/`,
			ProxyPass: FrontAuth,
		},
		{
			Path:      `/minha-conta/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:      `/minha-conta/dados-pessoais/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:      `/minha-conta/dados-pessoais/editar/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:         `/minha-conta/desativar-conta/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(os.Getenv("HOST_FULL_RECLAMEAQUI"), "/minha-conta/dados-pessoais/desativar/"), movedPermanently),
		},
		{
			Path:      `/minha-conta/dados-pessoais/desativar/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:      `/minha-conta/alterar-senha/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:      `/minha-conta/raprime/{rest:*}/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:      `/minha-conta/desativar-reclamacoes/{rest:*}/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:      `/minha-conta/minhas-reclamacoes/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:      `/minha-conta/responder-avaliar-reclamacao/{id}/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:      `/minha-conta/responder-avaliar-reclamacao/{id}/avaliar`,
			ProxyPass: LoggedArea,
		},
		{
			Path:      `/minha-conta/minhas-reclamacoes/{id}/desativar`,
			ProxyPass: LoggedArea,
		},
		{
			Path:         `/minha-conta/dados-pessoais-pj/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/minha-conta/{rest:*}/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/area-da-empresa/auditoria/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(ReclameAquiURL, `/area-da-empresa/verificacao/`), movedPermanently),
		},
		{
			Path:         `/area-da-empresa/{rest:*}/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:      `/area-da-empresa/minhas-marcas/`,
			ProxyPass: LoggedArea,
		},

		{
			Path:      `/area-da-empresa/minhas-marcas/editar/{id}/`,
			ProxyPass: LoggedArea,
		},

		{
			Path:      `/area-da-empresa/minhas-marcas/adicionar/`,
			ProxyPass: LoggedArea,
		},
		{
			Path:         `/empresas/{rest}/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(os.Getenv("HOST_FULL_RECLAMEAQUI"), "/area-da-empresa/"), movedPermanently),
		},
		{
			Path:      `/esqueci-minha-senha/`,
			ProxyPass: RARegistrations,
		},
		{
			Path:      `/esqueci-minha-senha/face-id/`,
			ProxyPass: RARegistrations,
		},
		{
			Path:      `/esqueci-minha-senha/face-id/documentacao/`,
			ProxyPass: RARegistrations,
		},
		{
			Path:      `/esqueci-minha-senha/recuperar-conta/{token}/`,
			ProxyPass: PublicArea,
		},
		{
			Path:      `/login-social/{rest:*}`,
			ProxyPass: RARegistrations,
		},
		{
			Path:      `/login-app/`,
			ProxyPass: PublicArea,
		},
		{
			Path:      `/esqueci-minha-senha/{token}/`,
			ProxyPass: RARegistrations,
		},
		{
			Path:      `/esqueci-minha-senha/empresa/biometria/`,
			ProxyPass: RACompanyRecovery,
		},
		{
			Path:      `/gestao-de-empresa/esqueci-minha-senha/`,
			ProxyPass: RACompanyRecovery,
		},
		{
			Path:      `/gestao-de-empresa/esqueci-minha-senha/reset/`,
			ProxyPass: RACompanyRecovery,
		},
		{
			Path:      `/gestao-de-empresa/esqueci-minha-senha/reset/{token}/`,
			ProxyPass: RACompanyRecovery,
		},
		{
			Path:      `/gestao-de-empresa/esqueci-minha-senha/convite`,
			ProxyPass: RACompanyRecovery,
		},
		{
			Path:      `/gestao-de-empresa/esqueci-minha-senha/convite/sem-documento`,
			ProxyPass: RACompanyRecovery,
		},
		{
			Path:         `/trocar-minha-senha/{rest:*}/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/areadoconsumidor/minhas_reclamacoes/{rest:*}/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/areadaempresa/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(os.Getenv("HOST_FULL_RECLAMEAQUI"), "/area-da-empresa/"), movedPermanently),
		},
		{
			Path:         `/busca/{rest:*}/`,
			UsePrerender: true,
			ProxyPass:    buscaProxyPass,
		},
		{
			Path:         `/termos-de-uso/`,
			UsePrerender: true,
			ProxyPass:    RAFaq,
		},

		{
			Path:         `/politica-de-privacidade/`,
			UsePrerender: true,
			ProxyPass:    RAFaq,
		},
		{
			Path:         `/consumer/{rest:*}/`,
			UsePrerender: true,
			ProxyPass:    RAConsumer,
		},

		{
			Path:         `/minha-conta/notificacoes/`,
			UsePrerender: true,
			ProxyPass:    RANotifications,
		},

		{
			Path:         `/minha-conta/notificacoes/{rest:*}/`,
			UsePrerender: true,
			ProxyPass:    RANotifications,
		},

		{
			Path:      `/home/{rest:*}/`,
			ProxyPass: RAHome,
		},

		{
			Path:         `/como-funciona/{rest:*}/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/resposta-empresa/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/contato/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/atendimento/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/fale-conosco/`,
			UsePrerender: true,
			ProxyPass:    PublicArea,
		},
		{
			Path:         `/fale-conosco/empresa/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint("https://faleconosco.reclameaqui.com.br/s/"), movedPermanently),
		},
		{
			Path:         `/fale-conosco/consumidor/`,
			UsePrerender: true,
			ProxyPass:    PublicArea,
		},
		{
			Path:         `/fale-conosco/empresa/formulario/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint("https://faleconosco.reclameaqui.com.br/s/"), movedPermanently),
		},
		{
			Path:         `/fale-conosco/consumidor/formulario/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(os.Getenv("HOST_FULL_RECLAMEAQUI"), "/fale-conosco/consumidor/"), movedPermanently),
		},
		{
			Path:         `/institucional/`,
			UsePrerender: true,
			ProxyPass:    PublicArea,
		},
		{
			Path:         `/ranking/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/ranking/segmentos/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/todos-rankings/{rest:*}/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/melhoresempresas/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/confirmacao/{rest:*}/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/categoria/{rest:*}/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(ReclameAquiURL, `/segmentos/`), movedPermanently),
		},
		{
			Path:         `/avaliar-chat/{rest:*}/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/avaliar-ligacao/{rest:*}/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:      `/cadastro-empresa/sucesso/{rest:*}/`,
			ProxyPass: PublicArea,
		},
		{
			Path:         `/cadastro-empresa/{rest:*}/`,
			RedirectFunc: helpers.RedirectUrl(fmt.Sprint(ReclameAquiURL, `/cadastro-de-empresa/`), movedPermanently),
		},
		{
			Path:         `/companysignup/{rest:*}/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/ecommerce/{rest:*}/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/bancos-e-cartoes/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/telefonia-tv-e-internet/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/turismo-e-lazer/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/casa-e-construcao/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/moveis-e-decoracao/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/educacao/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/veiculos-e-acessorios/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/saude/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/mae-e-bebe/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/moda/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/alimentos-e-bebidas/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/beleza-e-estetica/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/app-mobile/como_funciona/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/selo/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/coleta/{rest:*}/`,
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:      `/segmentos/{rest:*}/`,
			ProxyPass: RASegments,
		},
		{
			Path:      `/-new-brandpage/company/{rest:*}/`,
			ProxyPass: RABrandpage,
		},
		{
			Path:         `/indices/lista_reclamacoes/`,
			RedirectFunc: helpers.SpecialRedirect("list-complains"),
		},
		{
			Path:         `/indices/{id}/{empresa}/`,
			RedirectFunc: helpers.SpecialRedirect("old-company-redirect"),
		},
		// Exception for reading specific complaint (ADS-381)
		{
			Path:         fmt.Sprintf(`/{shortname:^(%s)$}/{description:^.*_(.{16}|[0-9]{6,10})$}/`, shortnameForPartialRelease),
			RedirectFunc: helpers.NewShortnameRedirect(0),
			ProxyPass:    PublicArea,
		},
		{
			Path:         `/{shortname}/{description:^.*_(.{16}|[0-9]{6,10})$}/`,
			RedirectFunc: helpers.NewShortnameRedirect(0),
			ProxyPass:    RAReadComplaint,
			UsePrerender: true,
		},
		{
			Path:      `/denuncia-reclamacao`,
			ProxyPass: RAReport,
		},
		{
			Path:         `/{shortname}/{description:^.*_(.{16}|[0-9]{6,10})$}/`,
			RedirectFunc: helpers.NewShortnameRedirect(0),
			ProxyPass:    PublicArea,
		},
		{
			Path:         `/{any}/{any}/{any}/`,
			RedirectFunc: helpers.SpecialRedirect("company"),
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/{category}/{term:^[a-zA-Z0-9-]+$}/`,
			RedirectFunc: helpers.SpecialRedirect("category"),
			UsePrerender: true,
			ProxyPass:    RaichuSite,
		},
		{
			Path: `/KsdFM1ByhsKfje/`,
			RewriteConf: &helpers.RewriteConf{
				RewriteFrom: `/(.*)/`,
				RewriteTo:   `/`,
			},
			ProxyPass: RAContent,
		},
	}
}

// Assets Routes
func GetAssetsRoutes() []RouteConfig {
	return []RouteConfig{

		{Path: `/ads.txt`, CustomHandler: "fileserver"},
		{Path: `/firebase-messaging-sw.js`, CustomHandler: "fileserver"},
		{Path: `/BingSiteAuth.xml`, CustomHandler: "fileserver"},
		{Path: `/webpush-service-worker.js`, CustomHandler: "fileserver"},
		{Path: `/verify-admitad.txt`, CustomHandler: "fileserver"},
		{Path: `/robots.txt`, CustomHandler: "fileserver"},
		{Path: `/favicon.ico`, CustomHandler: "fileserver"},
		{Path: `/silent-sso.html`, CustomHandler: "fileserver"},
		{Path: `/crypto-challenge.html`, CustomHandler: "fileserver"},
		{Path: `/crypto-challenge/main.css`, CustomHandler: "fileserver"},
		{Path: `/crypto-challenge/logoRA.svg`, CustomHandler: "fileserver"},
		{Path: `/premio/silent-sso.html`, CustomHandler: "fileserver"},
		{Path: `/error-page/cidade.png`, CustomHandler: "fileserver"},
		{Path: `/error-page/ops.png`, CustomHandler: "fileserver"},
		{Path: `/error-page/reclame-aqui-logo.svg`, CustomHandler: "fileserver"},
		{Path: `/sureroute/{rest:*}`, CustomHandler: "sureroute"},

		{Path: `/keycloak.json`, CustomHandler: "keycloak"},
		{Path: `/keycloak-staging.json`, CustomHandler: "keycloak", RestrictNamespaces: []string{"staging", "evo"}},
		{Path: `/keycloak-evolucao.json`, CustomHandler: "keycloak", RestrictNamespaces: []string{"evo", "staging"}},

		{Path: `/auth/token`, CustomHandler: "auth", Method: "POST"},
		{Path: `/auth/user-info`, CustomHandler: "auth", Method: "POST"},
		{Path: `/auth/logout`, CustomHandler: "auth", Method: "POST"},

		{Path: `/sso/social/token`, CustomHandler: "eevee_sso", Method: "POST", ProxyPass: EeveeSsoConsumer},
		{Path: `/sso/token`, CustomHandler: "eevee_sso", Method: "POST", ProxyPass: EeveeSsoConsumer},
		{Path: `/sso/user-info`, CustomHandler: "eevee_sso", Method: "POST", ProxyPass: EeveeSsoConsumer},
		{Path: `/sso/logout`, CustomHandler: "eevee_sso", Method: "POST", ProxyPass: EeveeSsoConsumer},

		{Path: `/remote/{rest:*}`, CustomHandler: "remote", Method: "GET"},

		{
			Path:      `/external/{rest:*}`,
			ProxyPass: RAContent,
		},

		{
			Path:      `/ra-content/{rest:*}`,
			ProxyPass: RAContent,
		},
		{
			Path:      `/ra-registrations/{rest:*}`,
			ProxyPass: RARegistrations,
		},
		{
			Path:      `/_ra_registrations/{rest:*}`,
			ProxyPass: RARegistrations,
		},
		{
			Path:      `/ra-search-area/{rest:*}`,
			ProxyPass: RASearchArea,
		},
		{
			Path:      `/_ra-search-area/{rest:*}`,
			ProxyPass: RASearchArea,
		},
		{
			Path:      `/ra-detector-sites/{rest:*}`,
			ProxyPass: RADetectorSites,
		},
		{
			Path:      `/_ra-detector-sites/{rest:*}`,
			ProxyPass: RADetectorSites,
		},
		{
			Path:      `/_ra-read-complaint/{rest:*}`,
			ProxyPass: RAReadComplaint,
		},
		{
			Path:      `/ra-read-complaint/{rest:*}`,
			ProxyPass: RAReadComplaint,
		},
		{
			Path:      `/_ra-report/{rest:*}`,
			ProxyPass: RAReport,
		},
		{
			Path:      `/ra-report/{rest:*}`,
			ProxyPass: RAReport,
		},
		{
			Path:      `/_logged-area-webapp/{rest:*}`,
			ProxyPass: LoggedAreaWebapp,
		},
		{
			Path:      `/ra-reviews-private/{rest:*}`,
			ProxyPass: RAReviewsPrivate,
		},
		{
			Path:      `/_ra-complaint/{rest:*}`,
			ProxyPass: RAComplaint,
		},
		{
			Path:      `/_ra-faq/{rest:*}`,
			ProxyPass: RAFaq,
		},
		{
			Path:      `/_ra-consumer/{rest:*}`,
			ProxyPass: RAConsumer,
		},

		{
			Path:      `/_ra-notifications/{rest:*}`,
			ProxyPass: RANotifications,
		},

		{
			Path:      `/_ra-home/{rest:*}`,
			ProxyPass: RAHome,
		},

		{
			Path:       `/_ra-compare/{rest:*}`,
			ProxyPass:  RACompare,
		},

		{
			Path:      `/ra-company-private/{rest:*}`,
			ProxyPass: RACompanyPrivate,
		},
		{
			Path:      `/_ra-company-recovery/{rest:*}`,
			ProxyPass: RACompanyRecovery,
		},
		{
			Path:      `/_ra-company-registration/{rest:*}`,
			ProxyPass: RACompanyRegistration,
		},
		{
			Path:      `/_premio-private-webapp/{rest:*}`,
			ProxyPass: PremioPrivate,
		},
		{
			Path:      `/_ra-home-private/{rest:*}`,
			ProxyPass: HomePrivate,
		},
		{
			Path:      `/_ra-brandpage/{rest:*}`,
			ProxyPass: RABrandpage,
		},
		{
			Path:      `/_premio-webapp/{rest:*}`,
			ProxyPass: PremioRA,
		},
		{
			Path:      `/_premio-voting-webapp/{rest:*}`,
			ProxyPass: VotingPremioRA,
		},
		{
			Path:      `/_ra-publication-private/{rest:*}`,
			ProxyPass: RAPublicationsPrivate,
		},
		{
			Path:      `/{folder:_app|_astro|~partytown}/{rest:*}`,
			ProxyPass: RAContent,
		},
		{
			Path: `/KsdFM1ByhsKfje/_app/{rest:*}`,
			RewriteConf: &helpers.RewriteConf{
				RewriteFrom: `/KsdFM1ByhsKfje/(.*)/`,
				RewriteTo:   `/$1/`,
			},
			ProxyPass: RAContent,
		},

		{
			Path:      `/ra-segments/{rest:*}`,
			ProxyPass: RASegments,
			RewriteConf: &helpers.RewriteConf{
				RewriteFrom: `/ra-segments/(.*)/`,
				RewriteTo:   `/$1/`,
			},
		},
		{
			Path:      `/_next/data/segmentos/apostas/casa-de-aposta.json`,
			ProxyPass: RASegments,
		},
		{
			Path:      `/ra-forms-private/{rest:*}`,
			ProxyPass: RAFormsPrivate,
			RewriteConf: &helpers.RewriteConf{
				RewriteFrom: `/ra-forms-private/(.*)/`,
				RewriteTo:   `/$1/`,
			},
		},
		{
			Path:      `/ra-premio-company/{rest:*}`,
			ProxyPass: RAPremioCompany,
			RewriteConf: &helpers.RewriteConf{
				RewriteFrom: `/ra-premio-company/(.*)/`,
				RewriteTo:   `/$1/`,
			},
		},
		{
			Path:      `/_next/data/premio/area-da-empresa.json`,
			ProxyPass: RAPremioCompany,
		},
		{
			Path:      `/front-auth/{rest:*}`,
			ProxyPass: FrontAuth,
			RewriteConf: &helpers.RewriteConf{
				RewriteFrom: `/front-auth/(.*)`,
				RewriteTo:   `/$1`,
			},
		},
		{
			Path:      `/sitemapgeralra/{route:*}`,
			ProxyPass: S3RaichuBeta,
			RewriteConf: &helpers.RewriteConf{
				RewriteFrom: `/sitemapgeralra/(.*)`,
				RewriteTo:   `/raichu-beta/$1`,
			},
			CustomHandler: "sitemap",
		},
		{
			Path: `/sw.js`,
			RedirectFunc: func(ctx *fasthttp.RequestCtx) (string, int) {
				return "", notFound
			},
		},
		{
			Path:         `/_nuxt/{rest:*}`,
			GatewayCache: AssetCache,
			ProxyPass:    PeaWebapp,
		},
		{
			Path:         `/static/{rest:*}`,
			GatewayCache: AssetCache,
			ProxyPass:    PublicArea,
		},
		{
			Path:         `/_next/{rest:*}`,
			GatewayCache: AssetCache,
			ProxyPass:    PublicArea,
		},
		{
			Path:      `/KsdFM1ByhsKfje/_next/{rest:*}`,
			ProxyPass: PublicAreaAds,
		},
		{
			Path:      `/KsdFM1ByhsKfje/images/{rest:*}`,
			ProxyPass: PublicAreaAds,
		},
		{
			Path:      `/assets/{rest:*}`,
			ProxyPass: RaichuSite,
		},

		{
			Path:      `/logged-area/static/{rest:*}`,
			ProxyPass: LoggedArea,
		},
		{
			Path:      `/logged-area/assets/{rest:*}`,
			ProxyPass: LoggedArea,
		},

		{
			Path:      `/premio/images/{rest:*}`,
			ProxyPass: LegacyPremioRA,
		},
		{
			Path:      `/premio/_next/{rest:*}`,
			ProxyPass: LegacyPremioRA,
		},
		{
			Path:         `/scripts/{rest:*}`,
			GatewayCache: AssetCache,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/images/{rest:*}`,
			GatewayCache: AssetCache,
			ProxyPass:    RaichuSite,
		},
		{
			Path:         `/styles/{rest:*}`,
			GatewayCache: AssetCache,
			ProxyPass:    RaichuSite,
		},
		{
			Path:      `/videos/{rest:*}`,
			ProxyPass: RaichuSite,
		},
		{
			Path:      `/rav/{rest:*}`,
			ProxyPass: LinkShortenerRAV,
		},
		{
			Path:      `/rav`,
			Method:    "POST",
			ProxyPass: LinkShortenerRAV,
		},
	}
}

func ConfigMapPreRender() map[string]*fasthttp.HostClient {
	return map[string]*fasthttp.HostClient{
		"_escaped_fragment_":      Prerender,
		"baiduspider":             Prerender,
		"twitterbot":              Prerender,
		"Twitterbot/1.0":          Prerender,
		"rogerbot":                Prerender,
		"linkedinbot":             Prerender,
		"LinkedInBot 1.0":         Prerender,
		"LinkedInBot/1.0":         Prerender,
		"embedly":                 Prerender,
		"quora link preview":      Prerender,
		"showyoubot":              Prerender,
		"outbrain":                Prerender,
		"pinterest":               Prerender,
		"slackbot":                Prerender,
		"vkShare":                 Prerender,
		"W3C_Validator":           Prerender,
		"WhatsApp/2.12.510 A":     Prerender,
		"WhatsApp":                Prerender,
		"Slurp":                   Prerender,
		"SkypeUriPreview":         Prerender,
		"Alexabot":                Prerender,
		"facebookexternalhit":     Prerender,
		"facebot":                 Prerender,
		"facebookexternalhit/1.1": Prerender,
	}
}
