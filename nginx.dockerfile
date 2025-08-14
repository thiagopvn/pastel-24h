FROM nginx:1.21-alpine

# Remove a configuração padrão do Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copia nossa configuração personalizada
COPY nginx.conf /etc/nginx/conf.d/

# Expõe a porta 80
EXPOSE 80

# O comando padrão do nginx já está configurado na imagem base