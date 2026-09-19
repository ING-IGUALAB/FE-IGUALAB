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

        stage('Test (En Contenedor Python)') {
            when {
                branch 'test'
            }
            agent {
                docker {
                    image 'python:3.13-slim'
                    reuseNode true
                }
            }
            steps {
                sh '''
                    python -m venv venv
                    . venv/bin/activate
                    pip install --no-cache-dir -r requirements.txt
                    pytest tests/ --cov=app --cov-report=xml:coverage.xml
                '''
            }
        }

        stage('SonarQube Analysis') {
            when {
                branch 'test'
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
                branch 'test'
            }
            steps {
                timeout(time: 1, unit: 'HOURS') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Deploy Test (Docker Compose)') {
            when {
                branch 'test'
            }
            steps {
                withCredentials([file(credentialsId: 'TEST_JENKINS_TEST', variable: 'SECRET_FILE')]) {
                    sh '''
                        cp "$SECRET_FILE" .env.test
                        docker compose -f docker-compose.test.yml down
                        docker compose -f docker-compose.test.yml up -d --build
                    '''
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
                        cp "$SECRET_FILE" .env
                        docker compose -f docker-compose.dev.yml down
                        docker compose -f docker-compose.dev.yml up -d --build
                    '''
                }
            }
        }
    }
}
