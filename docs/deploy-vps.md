# Implantação do Tessaro T&M em uma VPS

O build estático do Next.js e a API Fastify são servidos pelo mesmo processo Node.js. O exemplo usa Ubuntu ou Debian com systemd e Nginx. Tenha Git e Node.js **24.15 ou posterior da série 24** instalados para uso pela conta do serviço.

## Instalar e compilar

Em uma instalação nova, crie a conta de serviço e os diretórios do código e do SQLite.

```bash
sudo useradd --system --user-group --home-dir /var/lib/tessaro --shell /usr/sbin/nologin tessaro
sudo install -d -m 750 -o tessaro -g tessaro /var/lib/tessaro
sudo install -d -m 755 -o tessaro -g tessaro /srv/tessaro-tm
sudo -u tessaro -H git clone https://github.com/joaork/tessaro-tm.git /srv/tessaro-tm
cd /srv/tessaro-tm
sudo -u tessaro -H node --version
sudo -u tessaro -H npm --version
sudo -u tessaro install -m 600 .env.example .env
sudoedit .env
```

Defina no `.env` da VPS o caminho do banco e a porta interna. Preencha `TESSARO_OPENAI_API_KEY` se for usar a transcrição do OFÍCIO. O áudio local e a captura por texto funcionam com a variável vazia.

```dotenv
TESSARO_PORT=8787
TESSARO_DB=/var/lib/tessaro/tessaro.sqlite
TESSARO_OPENAI_API_KEY=
```

```bash
sudo -u tessaro -H npm ci --include=dev
sudo -u tessaro -H npm run build
```

## Executar como serviço

Crie `/etc/systemd/system/tessaro.service`. Use em `ExecStart` o caminho absoluto do Node.js 24 instalado na VPS.

```ini
[Unit]
Description=Tessaro T&M
After=network.target

[Service]
Type=simple
User=tessaro
Group=tessaro
WorkingDirectory=/srv/tessaro-tm
Environment=NODE_ENV=production
ExecStart=/usr/bin/node --env-file-if-exists=.env --import tsx src/server/index.ts --static
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tessaro
curl --fail --show-error http://127.0.0.1:8787/api/health
```

O teste deve retornar `{"status":"ok"}`. Para conferir o serviço e seu log, use `systemctl status tessaro` e `sudo journalctl -u tessaro -n 50`.

## Acessar pelo domínio

A API escuta em `127.0.0.1`. Aponte o DNS do seu domínio ou subdomínio para a VPS e encaminhe o acesso pelo Nginx. O navegador usa HTTPS para liberar o microfone fora de `localhost`. O exemplo aplica usuário e senha no proxy porque a demonstração usa uma base compartilhada. [Proxy no Nginx](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass) · [Microfone no navegador](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#privacy_and_security).

```bash
sudo apt-get update
sudo apt-get install nginx apache2-utils certbot python3-certbot-nginx
sudo htpasswd -cB /etc/nginx/tessaro.htpasswd guilherme
sudo chgrp www-data /etc/nginx/tessaro.htpasswd
sudo chmod 640 /etc/nginx/tessaro.htpasswd
```

Crie `/etc/nginx/sites-available/tessaro` e substitua `tessaro.seudominio.com` pelo domínio configurado. O proxy aceita 8 MiB para acomodar o arquivo e os campos do formulário. A aplicação valida arquivos de até 5 MiB.

```nginx
server {
    listen 80;
    server_name tessaro.seudominio.com;
    client_max_body_size 8m;

    location / {
        auth_basic "Tessaro T&M";
        auth_basic_user_file /etc/nginx/tessaro.htpasswd;
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Authorization "";
        proxy_read_timeout 120s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/tessaro /etc/nginx/sites-enabled/tessaro
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d tessaro.seudominio.com --redirect
curl --fail --show-error --user guilherme https://tessaro.seudominio.com/api/health
```

Depois do teste HTTPS, abra o endereço no navegador. No **Painel de trabalho**, carregue os dados demonstrativos para criar a primeira ficha. Para conferir o cenário oficial, use as [referências do desafio](referencias/README.md).

## Atualizar o projeto

O `.env` fica no servidor e o SQLite fica em `/var/lib/tessaro`, fora do checkout. Em uma janela de manutenção, faça backup do banco e atualize com os comandos abaixo.

```bash
cd /srv/tessaro-tm
sudo -u tessaro -H git pull --ff-only
sudo systemctl stop tessaro
sudo -u tessaro -H npm ci --include=dev
sudo -u tessaro -H npm run build
sudo systemctl start tessaro
curl --fail --show-error http://127.0.0.1:8787/api/health
```
