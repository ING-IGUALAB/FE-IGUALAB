pipeline {
    agent any

    options {
        buildDiscarder(logRotator(numToKeepStr: '5'))
    }

    stages {
        stage('Checkout Repo') {
            steps {
                checkout scm
            }
        }

        // Frontend: build + typecheck en un contenedor Node (equivalente al test del backend).
        stage('Build & Typecheck (Contenedor Node)') {
            agent {
                docker {
                    image 'node:24-alpine'
                    reuseNode true
                }
            }
            steps {
                sh '''
                    npm ci
                    npm run typecheck
                    npm run test:coverage
                    npm run build
                '''
            }
        }

        stage('SonarQube Analysis') {
            when {
                anyOf {
                    branch 'qa'
                    branch 'uat'
                }
            }
            agent {
                dockerfile {
                    filename 'Dockerfile.ci'
                    reuseNode true
                }
            }
            environment {
                scannerHome = tool 'SonarScanner'
            }
            steps {
                script {
                    def sonarUserHome = "${env.WORKSPACE}/.sonar"

                    withEnv(["SONAR_USER_HOME=${sonarUserHome}"]) {
                        sh 'node --version'
                        sh 'java --version'

                        if (env.BRANCH_NAME == 'qa') {
                            withSonarQubeEnv('SonarQube-Server') {
                                sh "${scannerHome}/bin/sonar-scanner -Dsonar.projectKey=FE-IGUALAB-QA -Dsonar.nodejs.executable=/usr/local/bin/node -Dsonar.userHome=${sonarUserHome}"
                            }
                        } else {
                            withSonarQubeEnv('SonarQube-Server') {
                                sh "${scannerHome}/bin/sonar-scanner -Dsonar.projectKey=FE-IGUALAB-UAT -Dsonar.nodejs.executable=/usr/local/bin/node -Dsonar.userHome=${sonarUserHome}"
                            }
                        }
                    }
                }
            }
        }

        stage('Quality Gate') {
            when {
                anyOf {
                    branch 'qa'
                    branch 'uat'
                }
            }
            steps {
                timeout(time: 1, unit: 'HOURS') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Deploy Dev (Docker Compose)') {
            when {
                branch 'development'
            }
            steps {
                withCredentials([file(credentialsId: 'IGUALAB_FRONTEND_DEV', variable: 'SECRET_FILE')]) {
                    sh '''
                        rm -f .env
                        cp "$SECRET_FILE" .env
                        docker compose -f docker-compose.dev.yml down
                        docker compose -f docker-compose.dev.yml up -d --build
                    '''
                }
            }
        }

        stage('Deploy QA (Docker Compose)') {
            when {
                branch 'qa'
            }
            steps {
                withCredentials([file(credentialsId: 'IGUALAB_FRONTEND_QA', variable: 'SECRET_FILE')]) {
                    sh '''
                        rm -f .env
                        cp "$SECRET_FILE" .env
                        docker compose -f docker-compose.qa.yml down
                        docker compose -f docker-compose.qa.yml up -d --build
                    '''
                }
            }
        }

        stage('Deploy UAT (Docker Compose)') {
            when {
                branch 'uat'
            }
            steps {
                withCredentials([file(credentialsId: 'IGUALAB_FRONTEND_UAT', variable: 'SECRET_FILE')]) {
                    sh '''
                        rm -f .env
                        cp "$SECRET_FILE" .env
                        docker compose -f docker-compose.uat.yml down
                        docker compose -f docker-compose.uat.yml up -d --build
                    '''
                }
            }
        }
    }
}
