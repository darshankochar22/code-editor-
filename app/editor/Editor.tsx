 import LeftComponent from '@/components/Left'; 
import RightComponent from '@/components/Right';

const EditorComponent = () => {
    return (
        <div className="flex h-screen w-full bg-black dark:bg-black">
           {/* Left Side */}
        <div className="w-[36%] p-4 dark:bg-black">
                <LeftComponent />
             </div>                                   
           {/* Right Side */}
           <div className="w-full p-4 bg-[#171717]">
                <RightComponent />
           </div>
        </div>
    )
}

export default EditorComponent;