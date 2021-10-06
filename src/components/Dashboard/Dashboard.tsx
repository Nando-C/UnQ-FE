import { useAppDispatch } from "../../redux/app/hooks"
import { Container, Button } from "react-bootstrap"
import { useEffect, useState } from "react"
import { fetchUserData } from "../../redux/slices/userSlice"
import ShopList from "../Shops/ShopList/ShopList"
import { fetchShopList } from "../../redux/slices/shopSlice"
import ShopModal from "../Shops/ShopModal/ShopModal"

const Dashboard = () => {
    const dispatch = useAppDispatch()

    useEffect(() => {
        dispatch(fetchUserData())
        dispatch(fetchShopList())
    }, )

    const [show, setShow] = useState(false);
    const handleClose = () => setShow(false);
    const handleShow = () => setShow(true);

    return (
        <Container>
            <div className="my-3 text-align-end">
                <Button onClick={handleShow}>Add Shop</Button>
            </div>
            <ShopList/>
            <ShopModal show={show} handleClose={handleClose} shopId={"new"}/>
        </Container>
    )
}

export default Dashboard