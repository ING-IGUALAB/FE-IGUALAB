pipeline {
    agent any

    options {
        // Solo se conserva la última ejecución y sus artefactos (reportes y evidencias e2e).
        buildDiscarder(logRotator(
            numToKeepStr: '1',
            artifactNumToKeepStr: '1'
        ))
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

        // E2E del frontend sobre la app YA DESPLEGADA en QA, en un navegador real (Chromium).
        // Usa servicios simulados (no toca el backend). Guarda video y captura de TODAS las
        // pruebas, pasen o fallen, más el reporte HTML y el JUnit, como artefactos del build.
        stage('E2E Tests') {
            when {
                branch 'qa'
            }
            agent {
                docker {
                    // La versión debe coincidir con la de @playwright/test en package.json.
                    image 'mcr.microsoft.com/playwright:v1.64.1-noble'
                    args '--ipc=host'
                    reuseNode true
                }
            }
            environment {
                CI = 'true'
                HOME = "${env.WORKSPACE}"
                E2E_BASE_URL = 'https://qa-igualab.ingsoftware.lat'
            }
            steps {
                sh '''
                    npm ci
                    node e2e/esperar-despliegue.mjs
                    npx playwright test
                '''
            }
            post {
                always {
                    // Resultado de cada prueba en la pestaña "Test Result" del build.
                    junit allowEmptyResults: true, testResults: 'e2e-results/junit.xml'
                    // Evidencias: reporte HTML (con videos y capturas), videos crudos y JUnit.
                    archiveArtifacts artifacts: 'playwright-report/**, test-results/**, e2e-results/**', allowEmptyArchive: true
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
