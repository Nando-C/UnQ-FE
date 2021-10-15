import { Card, Container, Image, Button } from "react-bootstrap"
import { useAppSelector } from "../../../redux/app/hooks"
import { selectUserData } from "../../../redux/slices/userSlice"
import { GrEdit } from "react-icons/gr"
import "./Account.css"
import { useState } from "react"
import AccountOffCanvas from "../AccountOffCanvas/AccountOffCanvas"

const Account = () => {
    const user = useAppSelector(selectUserData)

    const [show, setShow] = useState(false);
    const handleClose = () => setShow(false);
    const handleShow = () => setShow(true);

    return (
        <>
            <Container className="Account p-2">
                <Card className="p-2">
                    <Image className="p-5" src={user.avatar} fluid roundedCircle />
                    <Card.Title className="mt-3">
                        {user.name} {user.surname}
                    </Card.Title>
                    <Card.Body>
                        <Card.Text>
                            email: {user.email}
                        </Card.Text>
                        <Card.Text>
                            Role: {user.role}
                        </Card.Text>
                    </Card.Body>
                    <Button size={"lg"} onClick={handleShow}>
                        <GrEdit/>
                    </Button>
                </Card>
                <Button className="my-5">LogOut</Button>
            </Container>
            <AccountOffCanvas show={show} handleClose={handleClose}/>
        </>
    )
}

export default Account