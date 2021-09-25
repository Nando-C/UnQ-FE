import { FormEvent, useState } from "react"
import { Col, Container, Form, Row, Button, FloatingLabel, Image } from "react-bootstrap"
import { useHistory } from "react-router-dom"
import backend from "../../backend/backend"
import "../Register/Register.css"

const Login = () => {

    const [credentials, setCredentials] = useState({
        email: "",
        password: "",
    })

    const history = useHistory()

    const handleLogin = async (e: FormEvent) => {
        e.preventDefault()
        
        try {
            await backend.post("/auth/login", credentials)
            history.push("/")
        } catch (error) {
            console.log(error)
        }
    }

    return(
        <Container className="Register">
            <Row className="align-items-center">
                <Col xs={12} sm={6}>
                    <Image src="https://nayemdevs.com/wp-content/uploads/2020/03/default-product-image.png" rounded fluid/>
                </Col>
                <Col xs={12} sm={6}>
                    <Form onSubmit={handleLogin}>
                        <Form.Group className="mb-3" controlId="formBasicEmail">
                            <FloatingLabel controlId="floatingInput" label="Email address">
                                <Form.Control 
                                    type ="email" 
                                    placeholder="Enter email"
                                    value={credentials.email}
                                    onChange={e => setCredentials({ ...credentials, email: e.target.value })}
                                />
                            </FloatingLabel>
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="formBasicPassword">
                            <FloatingLabel controlId="floatingPassword" label="Password">
                                <Form.Control 
                                    type="password" 
                                    placeholder="Password"
                                    value={credentials.password}
                                    onChange={e => setCredentials({ ...credentials, password: e.target.value })}
                                />
                            </FloatingLabel>
                        </Form.Group>
                        <Button variant="primary" type="submit">
                            Login
                        </Button>
                    </Form>
                </Col>
            </Row>
        </Container>
    )
}

export default Login