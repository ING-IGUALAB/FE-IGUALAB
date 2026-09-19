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
                    image 'node:20-alpine'
                    reuseNode true
                }
            }
            steps {
                sh '''
                    npm ci
                    npm run typecheck
                    npm run build
                '''
            }
        }

        stage('SonarQube Analysis') {
            when {
                branch 'qa'
            }
            environment {
                scannerHome = tool 'SonarScanner'
            }
            steps {
                withSonarQubeEnv('SonarQube-Server') {
                    sh "${scannerHome}/bin/sonar-scanner"
                }
            }
        }

        stage('Quality Gate') {
            when {
                branch 'qa'
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
                withCredentials([file(credentialsId: 'TEST_JENKINS_DEV', variable: 'SECRET_FILE')]) {
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
                withCredentials([file(credentialsId: 'TEST_JENKINS_QA', variable: 'SECRET_FILE')]) {
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
                withCredentials([file(credentialsId: 'TEST_JENKINS_UAT', variable: 'SECRET_FILE')]) {
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
