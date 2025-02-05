FROM node:14.2.0-stretch

RUN useradd -ms /bin/bash cascades-nextgen-api

USER cascades-nextgen-api

WORKDIR /home/cascades-nextgen-api
COPY package*.json /home/cascades-nextgen-api/

ARG PORT_NUMBER

RUN npm install

RUN npm run build

EXPOSE ${PORT_NUMBER}

RUN mkdir -p /home/cascades-nextgen-api/src/server
COPY ./src/server /home/cascades-nextgen-api/src/server

CMD ["/bin/bash", "-c", "npm start" ]

ENTRYPOINT [ "/bin/bash", "-c", "npm start" ]