import { useState } from "react"
import { Col, Container, Form, Row, Button, FloatingLabel, Image } from "react-bootstrap"
import "./Register.css"

const Register = () => {

    const [credentials, setCredentials] = useState({
        name: "",
        surname: "",
        email: "",
        password: "",
    })

    const [verifyPassword, setVerifyPassword] = useState("")

    return(
        <Container className="Register">
            <Row className="align-items-center">
                <Col xs={12} sm={6}>
                    <Image src="https://nayemdevs.com/wp-content/uploads/2020/03/default-product-image.png" rounded fluid/>
                </Col>
                <Col xs={12} sm={6}>
                    <Form>
                        <Row>
                            <Col>
                                <Form.Group className="mb-3" controlId="formBasicEmail">
                                    <FloatingLabel controlId="floatingInput" label="First Name">
                                        <Form.Control 
                                            placeholder="First name"
                                            value={credentials.name}
                                            onChange={e => setCredentials({ ...credentials, name: e.target.value })} 
                                            isValid={credentials.name.length > 1}
                                        />
                                    </FloatingLabel> 
                                </Form.Group>
                            </Col>
                            <Col>
                                <Form.Group className="mb-3" controlId="formBasicEmail">
                                    <FloatingLabel controlId="floatingInput" label="Last Name">
                                        <Form.Control 
                                            placeholder="Last name"
                                            value={credentials.surname}
                                            onChange={e => setCredentials({ ...credentials, surname: e.target.value })}
                                            isValid={credentials.surname.length > 1}
                                        />
                                    </FloatingLabel>
                                </Form.Group>
                            </Col>
                        </Row>
                        <Form.Group className="mb-3" controlId="formBasicEmail">
                            <FloatingLabel controlId="floatingInput" label="Email address">
                                <Form.Control 
                                    type ="email" 
                                    placeholder="Enter email"
                                    value={credentials.email}
                                    onChange={e => setCredentials({ ...credentials, email: e.target.value })}
                                    isValid={credentials.email.split("@").length === 2}
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
                                    isValid={verifyPassword === credentials.password && verifyPassword !==""}
                                />
                            </FloatingLabel>
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="formBasicPassword">
                            <FloatingLabel controlId="floatingPassword" label="Re-type Password">
                                <Form.Control 
                                type="password" 
                                placeholder="Re-type Password"
                                value={verifyPassword}
                                onChange={e => setVerifyPassword( e.target.value )}
                                isInvalid={verifyPassword === credentials.password ? false : true}
                                isValid={verifyPassword === credentials.password && verifyPassword !==""}
                                />
                            </FloatingLabel>
                        </Form.Group>
                        <Button variant="primary" type="submit">
                            SignUp
                        </Button>
                    </Form>
                </Col>
            </Row>
        </Container>
    )
}

export default Register