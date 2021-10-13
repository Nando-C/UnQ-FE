import { useAppDispatch, useAppSelector } from "../../redux/app/hooks"
import { Container, Button } from "react-bootstrap"
import { useEffect, useState } from "react"
import { fetchUserData, selectUserData } from "../../redux/slices/userSlice"
import ShopList from "../Shops/ShopList/ShopList"
import TableMenu from "../Customers/TableMenu/TableMenu"
import { fetchShopList } from "../../redux/slices/shopSlice"
import ShopModal from "../Shops/ShopModal/ShopModal"
// import NavigationBar from "../Customers/NavigationBar/NavigationBar"

const Dashboard = () => {
    const dispatch = useAppDispatch()

    useEffect(() => {
        dispatch(fetchUserData())
    },[])
    
    const userDataStore = useAppSelector(selectUserData)
    const isManager = userDataStore.role === "shopMg" ? true : false
    
    if (isManager) {
        dispatch(fetchShopList())
    }

    const [show, setShow] = useState(false)
    const handleClose = () => setShow(false)
    const handleShow = () => setShow(true)

    return (
        <>
        {isManager
            ?
                <Container>
                    <div className="my-3 text-align-end">
                        <Button onClick={handleShow}>Add Shop</Button>
                    </div>
                    <ShopList/>
                    <ShopModal show={show} handleClose={handleClose} shopId={"new"}/>
                </Container>
            :
                <Container>
                    <h2>User Dashboard</h2>
                    <TableMenu/>
                    {/* <NavigationBar /> */}
                </Container>
        }
        </>
    )
}

export default Dashboard